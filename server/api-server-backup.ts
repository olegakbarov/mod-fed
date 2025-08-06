import { serve } from "bun";
import { Database } from "bun:sqlite";
import { join } from "node:path";
import { promisify } from "util";
import { AIAppGenerator } from "../src/generators/ai-generator";
import { rateLimiter, getClientIP, createRateLimitResponse } from "../src/middleware/rate-limiter";
import { authMiddleware, createUnauthorizedResponse, createForbiddenResponse } from "../src/middleware/auth";
import { validationMiddleware, createValidationErrorResponse } from "../src/middleware/validation";
import { securityHeaders, secureErrorMessages, initializeSecurityConfig, defaultSecurityConfig } from "../src/config/security-config";
import { metricsCollector } from "../src/monitoring/metrics";
import { logger, extractCorrelationId } from "../src/monitoring/logger";
import { healthChecker } from "../src/monitoring/health";
import { generationCache } from "../src/cache/generation-cache";
import { initializeConnectionPool, getConnectionPool, shutdownConnectionPool } from "../src/database/connection-pool";
import { withTransaction, withReadOnlyTransaction } from "../src/database/transactions";
import { runMigrations, isDatabaseUpToDate } from "../src/database/migrations";
import {
  DatabaseError,
  DatabaseConnectionError,
  DatabaseConstraintError,
  ValidationError,
  sanitizeErrorForResponse,
  categorizeError
} from "../src/errors/ai-errors";

const PORT = 3002;
const dbPath = join(process.cwd(), "app-data.db");

// Initialize security configuration from environment variables
try {
  Object.assign(defaultSecurityConfig, initializeSecurityConfig());
  logger.info('Security configuration initialized successfully');
} catch (error) {
  logger.error('Failed to initialize security configuration', { error });
  process.exit(1); // Exit in production if security config fails
}

// Initialize SQLite database with error handling
let db: Database;
try {
  db = new Database(dbPath, { create: true });
  logger.info('Database initialized', {
    database: { path: dbPath, type: 'sqlite' },
  });

  // Create tables with error handling
  const createTables = [
    {
      name: 'apps',
      sql: `
        CREATE TABLE IF NOT EXISTS apps (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          spec TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `,
    },
    {
      name: 'app_data',
      sql: `
        CREATE TABLE IF NOT EXISTS app_data (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          app_id INTEGER NOT NULL,
          entity_type TEXT NOT NULL,
          data TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE
        )
      `,
    },
    {
      name: 'dynamic_data',
      sql: `
        CREATE TABLE IF NOT EXISTS dynamic_data (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          collection TEXT NOT NULL,
          data TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `,
    },
  ];

  for (const table of createTables) {
    try {
      db.run(table.sql);
      logger.debug(`Table ${table.name} created/verified`, {
        database: { table: table.name, operation: 'create_table' },
      });
    } catch (error) {
      logger.error(`Failed to create table ${table.name}`, error as Error, {
        database: { table: table.name, operation: 'create_table' },
      });
      throw new DatabaseError(`Failed to create table ${table.name}`, 'create_table', table.name, false);
    }
  }

  logger.info('Database schema initialized successfully');
} catch (error) {
  logger.fatal('Failed to initialize database', error as Error, {
    database: { path: dbPath, operation: 'initialization' },
  });
  process.exit(1);
}

// Async database helper functions to avoid blocking the event loop
const asyncDb = {
  // Async wrapper for db.query().all()
  queryAll: (query: string, params?: any[]): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      setImmediate(() => {
        try {
          const stmt = db.prepare(query);
          const result = params ? stmt.all(...params) : stmt.all();
          resolve(result as any[]);
        } catch (error) {
          reject(error);
        }
      });
    });
  },

  // Async wrapper for db.query().get()
  queryGet: (query: string, params?: any[]): Promise<any> => {
    return new Promise((resolve, reject) => {
      setImmediate(() => {
        try {
          const stmt = db.prepare(query);
          const result = params ? stmt.get(...params) : stmt.get();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });
  },

  // Async wrapper for db.run()
  run: (query: string, params?: any[]): Promise<any> => {
    return new Promise((resolve, reject) => {
      setImmediate(() => {
        try {
          const stmt = db.prepare(query);
          const result = params ? stmt.run(...params) : stmt.run();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });
  },
};

// Enhanced CORS and security headers
const createSecureHeaders = (origin?: string | null) => {
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001', 
    'http://localhost:19006',
    // Add your production domains here
  ];
  
  const corsOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  
  return {
    "Access-Control-Allow-Origin": corsOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
    "Access-Control-Allow-Credentials": "false",
    "Content-Type": "application/json",
    ...securityHeaders,
  };
};

// Enhanced security middleware application
async function applySecurityMiddleware(req: Request, path: string, method: string) {
  const clientIP = getClientIP(req, defaultSecurityConfig.security.trustedProxies);
  const origin = req.headers.get('origin');
  const headers = createSecureHeaders(origin);
  
  // Apply rate limiting
  const authResult = authMiddleware.authenticate(req);
  const rateLimitResult = rateLimiter.checkLimit(clientIP, authResult.isAuthenticated);
  
  // Add rate limit headers to response
  Object.assign(headers, rateLimitResult.headers);
  
  if (!rateLimitResult.isAllowed) {
    return createRateLimitResponse(headers);
  }
  
  return {
    authResult,
    headers,
    clientIP,
  };
}

// Create secure error response
function createSecureErrorResponse(
  message: string,
  status: number = 500,
  code: string = 'INTERNAL_ERROR',
  headers: Record<string, string> = {}
): Response {
  // Log security events for monitoring
  if (status === 401 || status === 403 || status === 429) {
    console.warn(`Security event: ${code} - ${message}`);
  }
  
  return new Response(
    JSON.stringify({
      error: message,
      code,
      timestamp: new Date().toISOString(),
    }),
    { 
      status, 
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    }
  );
}

// Helper function to parse and validate JSON body
async function parseAndValidateBody(req: Request, endpoint?: 'generate' | 'data', collection?: string) {
  const validation = await validationMiddleware.validateRequestBody(req);
  
  if (!validation.isValid) {
    return {
      success: false,
      response: createValidationErrorResponse(validation.errors || []),
    };
  }
  
  // Apply endpoint-specific validation
  if (endpoint === 'generate') {
    const generateValidation = validationMiddleware.validateGenerateRequest(validation.data);
    if (!generateValidation.isValid) {
      return {
        success: false,
        response: createValidationErrorResponse(generateValidation.errors || []),
      };
    }
    return { success: true, data: generateValidation.sanitizedData };
  }
  
  if (endpoint === 'data' && collection) {
    const dataValidation = validationMiddleware.validateDataRequest(validation.data, collection);
    if (!dataValidation.isValid) {
      return {
        success: false,
        response: createValidationErrorResponse(dataValidation.errors || []),
      };
    }
    return { success: true, data: dataValidation.sanitizedData };
  }
  
  return { success: true, data: validation.sanitizedData };
}

serve({
  port: PORT,
  async fetch(req): Promise<Response> {
    const startTime = Date.now();
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;
    const origin = req.headers.get('origin');
    const correlationId = extractCorrelationId(req);
    const clientIP = getClientIP(req, defaultSecurityConfig.security.trustedProxies);
    const secureHeaders = createSecureHeaders(origin);

    // Add correlation ID to headers
    (secureHeaders as any)['X-Correlation-ID'] = correlationId;

    logger.debug('Request received', {
      request: {
        method,
        path,
        origin,
        clientIP,
        userAgent: req.headers.get('user-agent') || undefined,
      },
    }, correlationId);

    // Handle CORS preflight
    if (method === "OPTIONS") {
      const responseTime = Date.now() - startTime;
      metricsCollector.recordRequest({
        method,
        path,
        statusCode: 200,
        responseTime,
        timestamp: Date.now(),
        clientIP,
        correlationId,
      });
      return new Response(null, { headers: secureHeaders });
    }
    
    let response: Response;
    let statusCode = 200;
    
    try {
      // Apply security middleware (except for health check)
      if (path !== '/health') {
        const securityResult = await applySecurityMiddleware(req, path, method);
        
        if (securityResult instanceof Response) {
          return securityResult; // Rate limit exceeded
        }
        
        const { authResult, headers } = securityResult;
        
        // Store auth info and headers for use in endpoints
        (req as any).authResult = authResult;
        (req as any).secureHeaders = headers;
      }

      // Health check endpoints
      if (path === "/health") {
        try {
          const healthStatus = await healthChecker.checkHealth();
          statusCode = healthStatus.status === 'healthy' ? 200 : healthStatus.status === 'degraded' ? 200 : 503;
          response = Response.json(healthStatus, { status: statusCode, headers: secureHeaders });
          
          logger.debug('Health check completed', {
            health: { status: healthStatus.status, checks: healthStatus.checks.length },
          }, correlationId);
        } catch (error) {
          statusCode = 503;
          response = Response.json(
            sanitizeErrorForResponse(error as Error, process.env.NODE_ENV !== 'production'),
            { status: statusCode, headers: secureHeaders }
          );
          logger.error('Health check failed', error as Error, undefined, correlationId);
        }
      }
      
      // Quick health check for load balancers
      else if (path === "/health/quick") {
        try {
          const quickHealth = await healthChecker.quickCheck();
          statusCode = quickHealth.status === 'healthy' ? 200 : 503;
          response = Response.json(quickHealth, { status: statusCode, headers: secureHeaders });
        } catch (error) {
          statusCode = 503;
          response = Response.json(
            { status: 'unhealthy', error: 'Health check failed' },
            { status: statusCode, headers: secureHeaders }
          );
        }
      }
      
      // Metrics endpoint
      else if (path === "/metrics") {
        try {
          const metrics = metricsCollector.getPrometheusMetrics();
          response = new Response(metrics, {
            headers: { ...secureHeaders, 'Content-Type': 'text/plain' }
          });
        } catch (error) {
          statusCode = 500;
          response = Response.json(
            sanitizeErrorForResponse(error as Error),
            { status: statusCode, headers: secureHeaders }
          );
          logger.error('Metrics endpoint failed', error as Error, undefined, correlationId);
        }
      }
      
      // Detailed metrics endpoint  
      else if (path === "/api/metrics") {
        try {
          const detailedMetrics = metricsCollector.getDetailedMetrics();
          response = Response.json(detailedMetrics, { headers: secureHeaders });
        } catch (error) {
          statusCode = 500;
          response = Response.json(
            sanitizeErrorForResponse(error as Error),
            { status: statusCode, headers: secureHeaders }
          );
          logger.error('Detailed metrics endpoint failed', error as Error, undefined, correlationId);
        }
      }
      
      // Cache stats endpoint
      else if (path === "/api/cache/stats") {
        try {
          const cacheStats = generationCache.getDetailedStats();
          response = Response.json(cacheStats, { headers: secureHeaders });
        } catch (error) {
          statusCode = 500;
          response = Response.json(
            sanitizeErrorForResponse(error as Error),
            { status: statusCode, headers: secureHeaders }
          );
          logger.error('Cache stats endpoint failed', error as Error, undefined, correlationId);
        }
      }

      // Apps endpoints
      else if (path === "/api/apps") {
        const headers = (req as any).secureHeaders;
        
        if (method === "GET") {
          const apps = await asyncDb.queryAll("SELECT * FROM apps ORDER BY created_at DESC");
          return Response.json(apps, { headers });
        }
        
        if (method === "POST") {
          const parseResult = await parseAndValidateBody(req);
          if (!parseResult.success) {
            return parseResult.response;
          }
          
          const body = parseResult.data;
          if (!body.name || !body.spec) {
            return createValidationErrorResponse(['Missing name or spec'], headers);
          }
          
          const result = await asyncDb.run("INSERT INTO apps (name, spec) VALUES (?, ?)", [body.name, JSON.stringify(body.spec)]);
          
          const newApp = await asyncDb.queryGet("SELECT * FROM apps WHERE id = ?", [result.lastInsertRowid]);
          return Response.json(newApp, { headers });
        }
      }

      // Get single app
      else if (path.match(/^\/api\/apps\/(\d+)$/)) {
        const appMatch = path.match(/^\/api\/apps\/(\d+)$/)!;
        const appId = parseInt(appMatch[1]);
        const headers = (req as any).secureHeaders;
        
        if (method === "GET") {
          const app = await asyncDb.queryGet("SELECT * FROM apps WHERE id = ?", [appId]);
          if (!app) {
            return createSecureErrorResponse(secureErrorMessages.NOT_FOUND, 404, 'NOT_FOUND', headers);
          }
          return Response.json(app, { headers });
        }
        
        if (method === "DELETE") {
          await asyncDb.run("DELETE FROM apps WHERE id = ?", [appId]);
          return Response.json({ success: true }, { headers });
        }
      }

      // Dynamic data endpoints (for generated apps to use)  
      else if (path.startsWith("/api/data/")) {
        const collection = path.replace("/api/data/", "").split('/')[0];
        const headers = (req as any).secureHeaders;
        
        if (method === "GET") {
          const items = await asyncDb.queryAll("SELECT * FROM dynamic_data WHERE collection = ? ORDER BY created_at DESC", [collection]);
          return Response.json(items.map((item: any) => ({ 
            id: item.id, 
            ...JSON.parse(item.data as string),
            created_at: item.created_at,
            updated_at: item.updated_at
          })), { headers });
        }
        
        if (method === "POST") {
          const parseResult = await parseAndValidateBody(req, 'data', collection);
          if (!parseResult.success) {
            return parseResult.response;
          }
          
          const body = parseResult.data;
          if (!body || Object.keys(body).length === 0) {
            return createValidationErrorResponse(['Request body cannot be empty'], headers);
          }
          
          const result = await asyncDb.run("INSERT INTO dynamic_data (collection, data) VALUES (?, ?)", [collection, JSON.stringify(body)]);
          
          const newItem = await asyncDb.queryGet("SELECT * FROM dynamic_data WHERE id = ?", [result.lastInsertRowid]);
          return Response.json({ 
            id: newItem.id, 
            ...JSON.parse(newItem.data as string),
            created_at: newItem.created_at,
            updated_at: newItem.updated_at
          }, { headers });
        }
      }

      // Handle single item operations
      else if (path.match(/^\/api\/data\/([^\/]+)\/(\d+)$/)) {
        const itemMatch = path.match(/^\/api\/data\/([^\/]+)\/(\d+)$/)!;
        const [, collection, itemId] = itemMatch;
        const id = parseInt(itemId);
        const headers = (req as any).secureHeaders;
        
        if (method === "GET") {
          const item = await asyncDb.queryGet("SELECT * FROM dynamic_data WHERE collection = ? AND id = ?", [collection, id]);
          if (!item) {
            return createSecureErrorResponse(secureErrorMessages.NOT_FOUND, 404, 'NOT_FOUND', headers);
          }
          return Response.json({ 
            id: item.id, 
            ...JSON.parse(item.data as string),
            created_at: item.created_at,
            updated_at: item.updated_at
          }, { headers });
        }
        
        if (method === "PUT") {
          const parseResult = await parseAndValidateBody(req, 'data', collection);
          if (!parseResult.success) {
            return parseResult.response;
          }
          
          const body = parseResult.data;
          if (!body || Object.keys(body).length === 0) {
            return createValidationErrorResponse(['Request body cannot be empty'], headers);
          }
          
          await asyncDb.run(
            "UPDATE dynamic_data SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE collection = ? AND id = ?",
            [JSON.stringify(body), collection, id]
          );
          
          const updatedItem = await asyncDb.queryGet("SELECT * FROM dynamic_data WHERE collection = ? AND id = ?", [collection, id]);
          if (!updatedItem) {
            return createSecureErrorResponse(secureErrorMessages.NOT_FOUND, 404, 'NOT_FOUND', headers);
          }
          
          return Response.json({ 
            id: updatedItem.id, 
            ...JSON.parse(updatedItem.data as string),
            created_at: updatedItem.created_at,
            updated_at: updatedItem.updated_at
          }, { headers });
        }
        
        if (method === "DELETE") {
          const result = await asyncDb.run("DELETE FROM dynamic_data WHERE collection = ? AND id = ?", [collection, id]);
          if (result.changes === 0) {
            return createSecureErrorResponse(secureErrorMessages.NOT_FOUND, 404, 'NOT_FOUND', headers);
          }
          return Response.json({ success: true }, { headers });
        }
      }

      // Stats endpoint  
      else if (path === "/api/stats") {
        const headers = (req as any).secureHeaders;
        const appCount = await asyncDb.queryGet("SELECT COUNT(*) as count FROM apps");
        const dataCount = await asyncDb.queryGet("SELECT COUNT(*) as count FROM dynamic_data");
        const collections = await asyncDb.queryAll("SELECT DISTINCT collection FROM dynamic_data");
        const rateLimitStats = rateLimiter.getStats();
        
        return Response.json({
          apps: appCount.count,
          dataItems: dataCount.count,
          collections: collections.map((c: any) => c.collection),
          security: {
            rateLimitStats,
            timestamp: new Date().toISOString(),
          },
        }, { headers });
      }

      // AI Generate endpoint - Enhanced with authentication and validation
      else if (path === "/api/generate" && method === "POST") {
        const headers = (req as any).secureHeaders;
        const authResult = (req as any).authResult;
        
        logger.info('AI generation request received', {
          generation: { authenticated: authResult.isAuthenticated },
        }, correlationId);
        
        try {
          const parseResult = await parseAndValidateBody(req, 'generate');
          if (!parseResult.success) {
            statusCode = 400;
            response = parseResult.response;
            logger.warn('Generation request validation failed', undefined, {
              validation: { errors: 'Request validation failed' },
            }, correlationId);
          } else {
            const body = parseResult.data;
            if (!body.prompt) {
              statusCode = 400;
              response = createValidationErrorResponse(['Missing prompt'], headers);
            } else {
              const generator = new AIAppGenerator();
              const appSpec = await generator.generateApp(body.prompt, correlationId);
              
              // Save generated app to database with error handling
              try {
                const dbStartTime = Date.now();
                const result = await asyncDb.run("INSERT INTO apps (name, spec) VALUES (?, ?)", [appSpec.appName, JSON.stringify(appSpec)]);
                const dbTime = Date.now() - dbStartTime;
                
                logger.database('INSERT', 'apps', dbTime, true, {
                  database: { appName: appSpec.appName },
                }, correlationId);
                
                const newApp = await asyncDb.queryGet("SELECT * FROM apps WHERE id = ?", [result.lastInsertRowid]);
                
                // Include user tier info in response if authenticated
                const responseData: any = { 
                  app: newApp,
                  spec: appSpec,
                  generated_at: new Date().toISOString(),
                };
                
                if (authResult.isAuthenticated && authResult.keyInfo) {
                  responseData.user_tier = authResult.keyInfo.tier;
                }
                
                response = Response.json(responseData, { headers });
                
                logger.info('App generation completed successfully', {
                  generation: {
                    appName: appSpec.appName,
                    screensCount: appSpec.screens.length,
                    databaseId: newApp.id,
                  },
                }, correlationId);
              } catch (dbError) {
                const error = new DatabaseError(
                  'Failed to save generated app',
                  'INSERT',
                  'apps',
                  true,
                  correlationId,
                  dbError as Error
                );
                
                logger.error('Failed to save generated app to database', error, {
                  generation: { appName: appSpec.appName },
                }, correlationId);
                
                // Still return the generated spec even if we can't save it
                const responseData = {
                  spec: appSpec,
                  generated_at: new Date().toISOString(),
                  warning: 'Generated successfully but could not be saved to database',
                };
                
                response = Response.json(responseData, { headers });
              }
            }
          }
        } catch (error) {
          const categorized = categorizeError(error as Error);
          statusCode = (error as any).statusCode || 500;
          
          logger.error('AI generation failed', error as Error, {
            generation: {
              category: categorized.category,
              severity: categorized.severity,
              actionRequired: categorized.actionRequired,
            },
          }, correlationId);
          
          response = Response.json(
            sanitizeErrorForResponse(error as Error, process.env.NODE_ENV !== 'production'),
            { status: statusCode, headers }
          );
        }
      }

      // Default: Not found
      else {
        statusCode = 404;
        response = Response.json(
          sanitizeErrorForResponse(new Error(secureErrorMessages.NOT_FOUND)),
          {
            status: 404,
            headers: (req as any).secureHeaders || createSecureHeaders()
          }
        );
        
        logger.warn('Endpoint not found', undefined, {
          request: { method, path },
        }, correlationId);
      }
    } catch (error) {
      statusCode = 500;
      const categorized = categorizeError(error as Error);
      
      logger.error('Unhandled server error', error as Error, {
        error: {
          category: categorized.category,
          severity: categorized.severity,
          actionRequired: categorized.actionRequired,
        },
        request: { method, path },
      }, correlationId);

      response = Response.json(
        sanitizeErrorForResponse(error as Error, process.env.NODE_ENV !== 'production'),
        {
          status: 500,
          headers: createSecureHeaders()
        }
      );
    } finally {
      // Record request metrics
      const responseTime = Date.now() - startTime;
      
      metricsCollector.recordRequest({
        method,
        path,
        statusCode,
        responseTime,
        timestamp: Date.now(),
        clientIP,
        userAgent: req.headers.get('user-agent') || undefined,
        correlationId,
        error: statusCode >= 400 ? `HTTP ${statusCode}` : undefined,
      });

      // Log request completion
      logger.request(method, path, statusCode, responseTime, {
        request: {
          origin,
          userAgent: req.headers.get('user-agent') || undefined,
        },
      }, correlationId);
    }

    return response;
  },
});

// Log server startup
logger.info('API server started successfully', {
  server: {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
    platform: process.platform,
    architecture: process.arch,
  },
});

// Log available endpoints for development
if (process.env.NODE_ENV !== 'production') {
  const endpoints = [
    // Core API endpoints
    { method: 'POST', path: '/api/generate', description: 'AI-powered app generation' },
    { method: 'GET', path: '/api/apps', description: 'List all apps' },
    { method: 'POST', path: '/api/apps', description: 'Create new app' },
    { method: 'GET', path: '/api/apps/:id', description: 'Get specific app' },
    { method: 'DELETE', path: '/api/apps/:id', description: 'Delete specific app' },
    
    // Data endpoints
    { method: 'GET', path: '/api/data/:collection', description: 'Get collection data' },
    { method: 'POST', path: '/api/data/:collection', description: 'Add data to collection' },
    { method: 'GET', path: '/api/data/:collection/:id', description: 'Get specific data item' },
    { method: 'PUT', path: '/api/data/:collection/:id', description: 'Update specific data item' },
    { method: 'DELETE', path: '/api/data/:collection/:id', description: 'Delete specific data item' },
    
    // Stats and monitoring endpoints
    { method: 'GET', path: '/api/stats', description: 'Application statistics' },
    { method: 'GET', path: '/api/metrics', description: 'Detailed metrics (JSON)' },
    { method: 'GET', path: '/api/cache/stats', description: 'Cache statistics' },
    { method: 'GET', path: '/metrics', description: 'Prometheus metrics' },
    
    // Health endpoints
    { method: 'GET', path: '/health', description: 'Comprehensive health check' },
    { method: 'GET', path: '/health/quick', description: 'Quick health check for load balancers' },
  ];
  
  console.log(`\n🚀 AI App Generator API Server`);
  console.log(`📍 Running at: http://localhost:${PORT}`);
  console.log(`\n📋 Available Endpoints:`);
  
  endpoints.forEach(({ method, path, description }) => {
    console.log(`  ${method.padEnd(6)} http://localhost:${PORT}${path.padEnd(35)} - ${description}`);
  });
  
  console.log(`\n🔧 Development Tools:`);
  console.log(`  Health Check:     curl http://localhost:${PORT}/health`);
  console.log(`  Metrics:          curl http://localhost:${PORT}/api/metrics`);
  console.log(`  Cache Stats:      curl http://localhost:${PORT}/api/cache/stats`);
  console.log(`  Generate App:     curl -X POST http://localhost:${PORT}/api/generate -H "Content-Type: application/json" -d '{"prompt":"Create a todo app"}'`);
  console.log(`\n💡 View logs in structured format by setting LOG_LEVEL=0 for debug mode\n`);
}

// Set up graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}, starting graceful shutdown`, {
    server: { signal, uptime: process.uptime() },
  });
  
  try {
    // Close database connection
    if (db) {
      db.close();
      logger.info('Database connection closed');
    }
    
    // Destroy cache
    generationCache.destroy();
    logger.info('Cache destroyed');
    
    // Log final metrics
    const finalMetrics = metricsCollector.getDetailedMetrics();
    logger.info('Final server metrics', { metrics: finalMetrics });
    
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.fatal('Error during graceful shutdown', error as Error);
    process.exit(1);
  }
};

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', (error: Error) => {
  logger.fatal('Uncaught exception', error, {
    error: { type: 'uncaughtException' },
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.fatal('Unhandled promise rejection', reason instanceof Error ? reason : new Error(String(reason)), {
    error: { type: 'unhandledRejection', promise: String(promise) },
  });
  process.exit(1);
});