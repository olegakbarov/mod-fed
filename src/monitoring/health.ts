import { Database } from 'bun:sqlite';
import { metricsCollector } from './metrics';
import { logger } from './logger';
import { generationCache } from '../cache/generation-cache';
import { AI_CONFIG } from '../config/ai-config';

export interface HealthCheckResult {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime: number;
  error?: string;
  details?: Record<string, any>;
}

export interface SystemHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  checks: HealthCheckResult[];
  summary: {
    total: number;
    healthy: number;
    unhealthy: number;
    degraded: number;
  };
}

export class HealthChecker {
  private startTime: number;
  private checks: Map<string, () => Promise<HealthCheckResult>>;
  private memoryHistory: Array<{ timestamp: number; heapUsed: number; rss: number }>;

  constructor() {
    this.startTime = Date.now();
    this.checks = new Map();
    this.memoryHistory = [];
    this.registerDefaultChecks();
  }

  // Register a health check
  registerCheck(name: string, checkFunction: () => Promise<HealthCheckResult>): void {
    this.checks.set(name, checkFunction);
  }

  // Remove a health check
  unregisterCheck(name: string): void {
    this.checks.delete(name);
  }

  // Run all health checks
  async checkHealth(timeoutMs: number = 10000): Promise<SystemHealth> {
    const startTime = Date.now();
    const results: HealthCheckResult[] = [];

    // Run all checks with timeout
    const checkPromises = Array.from(this.checks.entries()).map(async ([name, checkFn]) => {
      try {
        // Add timeout to individual checks
        const timeoutPromise = new Promise<HealthCheckResult>((_, reject) => {
          setTimeout(() => reject(new Error('Health check timeout')), timeoutMs / this.checks.size);
        });

        const result = await Promise.race([checkFn(), timeoutPromise]);
        return result;
      } catch (error) {
        return {
          name,
          status: 'unhealthy' as const,
          responseTime: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    const checkResults = await Promise.allSettled(checkPromises);
    
    for (const result of checkResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({
          name: 'unknown',
          status: 'unhealthy',
          responseTime: Date.now() - startTime,
          error: result.reason?.message || 'Check failed',
        });
      }
    }

    // Calculate overall status
    const summary = {
      total: results.length,
      healthy: results.filter(r => r.status === 'healthy').length,
      unhealthy: results.filter(r => r.status === 'unhealthy').length,
      degraded: results.filter(r => r.status === 'degraded').length,
    };

    let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    if (summary.unhealthy > 0) {
      overallStatus = 'unhealthy';
    } else if (summary.degraded > 0) {
      overallStatus = 'degraded';
    }

    const systemHealth: SystemHealth = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      checks: results,
      summary,
    };

    // Log health check results
    logger.debug('Health check completed', {
      health: {
        status: overallStatus,
        checks: results.length,
        responseTime: Date.now() - startTime,
        summary,
      },
    });

    return systemHealth;
  }

  // Quick health check (essential services only)
  async quickCheck(): Promise<{ status: 'healthy' | 'unhealthy'; responseTime: number }> {
    const startTime = Date.now();
    
    try {
      // Check essential services only
      const essentialChecks = ['database', 'metrics', 'logger'];
      const results: HealthCheckResult[] = [];

      for (const checkName of essentialChecks) {
        const checkFn = this.checks.get(checkName);
        if (checkFn) {
          try {
            const result = await Promise.race([
              checkFn(),
              new Promise<HealthCheckResult>((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), 1000)
              ),
            ]);
            results.push(result);
          } catch (error) {
            results.push({
              name: checkName,
              status: 'unhealthy',
              responseTime: Date.now() - startTime,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
      }

      const hasUnhealthy = results.some(r => r.status === 'unhealthy');
      
      return {
        status: hasUnhealthy ? 'unhealthy' : 'healthy',
        responseTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
      };
    }
  }

  private registerDefaultChecks(): void {
    // Database health check
    this.registerCheck('database', async (): Promise<HealthCheckResult> => {
      const startTime = Date.now();
      
      try {
        // Create a test database connection
        const testDb = new Database(':memory:');
        
        // Test basic database operations
        testDb.run('CREATE TABLE test_health (id INTEGER PRIMARY KEY, value TEXT)');
        testDb.run('INSERT INTO test_health (value) VALUES (?)', ['health_check']);
        const result = testDb.query('SELECT * FROM test_health WHERE value = ?').get('health_check');
        
        testDb.close();

        if (!result) {
          throw new Error('Database test query failed');
        }

        return {
          name: 'database',
          status: 'healthy',
          responseTime: Date.now() - startTime,
          details: {
            type: 'sqlite',
            testPassed: true,
          },
        };
      } catch (error) {
        return {
          name: 'database',
          status: 'unhealthy',
          responseTime: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Database check failed',
        };
      }
    });

    // Metrics collector health check
    this.registerCheck('metrics', async (): Promise<HealthCheckResult> => {
      const startTime = Date.now();
      
      try {
        const isHealthy = metricsCollector.isHealthy();
        const stats = metricsCollector.getDetailedMetrics();

        return {
          name: 'metrics',
          status: isHealthy ? 'healthy' : 'degraded',
          responseTime: Date.now() - startTime,
          details: {
            isCollecting: isHealthy,
            requestStats: stats.requests,
            systemStats: stats.system,
          },
        };
      } catch (error) {
        return {
          name: 'metrics',
          status: 'unhealthy',
          responseTime: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Metrics check failed',
        };
      }
    });

    // Logger health check
    this.registerCheck('logger', async (): Promise<HealthCheckResult> => {
      const startTime = Date.now();
      
      try {
        const isHealthy = logger.isHealthy();
        const logMetrics = logger.getLogMetrics();

        return {
          name: 'logger',
          status: isHealthy ? 'healthy' : 'degraded',
          responseTime: Date.now() - startTime,
          details: {
            isWorking: isHealthy,
            totalLogs: logMetrics.totalLogs,
            recentErrors: logMetrics.recentErrorCount,
            bufferUtilization: logMetrics.bufferUtilization,
          },
        };
      } catch (error) {
        return {
          name: 'logger',
          status: 'unhealthy',
          responseTime: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Logger check failed',
        };
      }
    });

    // Cache health check
    this.registerCheck('cache', async (): Promise<HealthCheckResult> => {
      const startTime = Date.now();
      
      try {
        const isHealthy = generationCache.isHealthy();
        const stats = generationCache.getStats();

        let status: 'healthy' | 'degraded' = 'healthy';
        if (!isHealthy) {
          status = 'degraded';
        } else if (stats.utilization > 90) {
          status = 'degraded'; // Cache is nearly full
        }

        return {
          name: 'cache',
          status,
          responseTime: Date.now() - startTime,
          details: {
            isWorking: isHealthy,
            entries: stats.entries,
            utilization: stats.utilization,
            hitRate: stats.hitRate,
            size: stats.size,
            maxSize: stats.maxSize,
          },
        };
      } catch (error) {
        return {
          name: 'cache',
          status: 'unhealthy',
          responseTime: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Cache check failed',
        };
      }
    });

    // AI Provider health check
    this.registerCheck('ai_provider', async (): Promise<HealthCheckResult> => {
      const startTime = Date.now();
      
      try {
        const hasApiKey = Boolean(AI_CONFIG.apiKey);
        
        // If no API key, it's degraded (fallback mode)
        const status = hasApiKey ? 'healthy' : 'degraded';

        return {
          name: 'ai_provider',
          status,
          responseTime: Date.now() - startTime,
          details: {
            provider: AI_CONFIG.provider,
            model: AI_CONFIG.model,
            hasApiKey: hasApiKey,
            mode: hasApiKey ? 'ai' : 'fallback',
          },
        };
      } catch (error) {
        return {
          name: 'ai_provider',
          status: 'unhealthy',
          responseTime: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'AI provider check failed',
        };
      }
    });

    // Enhanced memory usage check with pressure detection
    this.registerCheck('memory', async (): Promise<HealthCheckResult> => {
      const startTime = Date.now();
      
      try {
        const usage = process.memoryUsage();
        const heapUsedMB = usage.heapUsed / 1024 / 1024;
        const heapTotalMB = usage.heapTotal / 1024 / 1024;
        const rssMB = usage.rss / 1024 / 1024;
        const externalMB = usage.external / 1024 / 1024;
        const utilization = (usage.heapUsed / usage.heapTotal) * 100;

        let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
        let warnings: string[] = [];
        
        // More granular thresholds for better monitoring
        if (heapUsedMB > 256) { // 256MB threshold
          status = 'degraded';
          warnings.push('High heap memory usage detected');
        }
        if (heapUsedMB > 512) { // 512MB threshold
          status = 'unhealthy';
          warnings.push('Critical heap memory usage - consider increasing memory or optimizing');
        }
        if (rssMB > 1024) { // 1GB RSS threshold
          status = 'unhealthy';
          warnings.push('High RSS memory usage - potential memory leak');
        }
        if (utilization > 90) {
          status = 'unhealthy';
          warnings.push('High memory utilization - approaching heap limit');
        }

        // Trigger garbage collection if memory is critically high
        if (heapUsedMB > 512 && global.gc) {
          try {
            global.gc();
            logger.warn('Manual garbage collection triggered due to high memory usage', {
              memory: { heapUsedMB, trigger: 'health_check' },
            });
            warnings.push('Automatic GC triggered');
          } catch (error) {
            warnings.push('Failed to trigger automatic GC');
          }
        } else if (heapUsedMB > 512 && !global.gc) {
          warnings.push('High memory usage detected but manual GC not available. Start with --expose-gc flag.');
        }

        return {
          name: 'memory',
          status,
          responseTime: Date.now() - startTime,
          details: {
            heapUsed: `${heapUsedMB.toFixed(2)}MB`,
            heapTotal: `${heapTotalMB.toFixed(2)}MB`,
            utilization: `${utilization.toFixed(1)}%`,
            rss: `${rssMB.toFixed(2)}MB`,
            external: `${externalMB.toFixed(2)}MB`,
            arrayBuffers: `${(usage.arrayBuffers / 1024 / 1024).toFixed(2)}MB`,
            warnings: warnings,
            thresholds: {
              degraded: '256MB heap',
              unhealthy: '512MB heap or 1GB RSS',
            },
          },
        };
      } catch (error) {
        return {
          name: 'memory',
          status: 'unhealthy',
          responseTime: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Memory check failed',
        };
      }
    });

    // Memory pressure monitoring with trend analysis
    this.registerCheck('memory_pressure', async (): Promise<HealthCheckResult> => {
      const startTime = Date.now();
      
      try {
        const usage = process.memoryUsage();
        const heapUsedMB = usage.heapUsed / 1024 / 1024;
        const rssMB = usage.rss / 1024 / 1024;
        
        // Store recent memory readings for trend analysis
        const now = Date.now();
        this.memoryHistory.push({ timestamp: now, heapUsed: heapUsedMB, rss: rssMB });
        
        // Keep only last 10 readings (last 5 minutes if checked every 30 seconds)
        if (this.memoryHistory.length > 10) {
          this.memoryHistory = this.memoryHistory.slice(-10);
        }
        
        let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
        const warnings: string[] = [];
        
        // Analyze memory trends if we have enough data
        if (this.memoryHistory.length >= 3) {
          const recent = this.memoryHistory.slice(-3);
          const isIncreasing = recent.every((reading, idx) => 
            idx === 0 || reading.heapUsed > recent[idx - 1].heapUsed
          );
          const growthRate = recent.length > 1 ? 
            (recent[recent.length - 1].heapUsed - recent[0].heapUsed) / (recent.length - 1) : 0;
          
          if (isIncreasing && growthRate > 10) { // Growing by more than 10MB per check
            status = 'degraded';
            warnings.push(`Memory usage increasing rapidly: +${growthRate.toFixed(1)}MB per check`);
          }
          
          // Check if memory is consistently high
          const avgMemory = recent.reduce((sum, r) => sum + r.heapUsed, 0) / recent.length;
          if (avgMemory > 400) { // Average above 400MB
            status = 'degraded';
            warnings.push(`Consistently high memory usage: ${avgMemory.toFixed(1)}MB average`);
          }
        }
        
        // Critical thresholds
        if (heapUsedMB > 600) {
          status = 'unhealthy';
          warnings.push('Critical memory usage detected');
          
          // Trigger emergency cleanup
          if (global.gc) {
            global.gc();
            logger.error('Emergency garbage collection triggered', {
              memory: { heapUsedMB, rssMB, trigger: 'memory_pressure' },
            });
          }
        }
        
        return {
          name: 'memory_pressure',
          status,
          responseTime: Date.now() - startTime,
          details: {
            currentHeapUsed: `${heapUsedMB.toFixed(2)}MB`,
            currentRSS: `${rssMB.toFixed(2)}MB`,
            trendAnalysis: this.memoryHistory.length >= 3 ? 'enabled' : 'insufficient_data',
            dataPoints: this.memoryHistory.length,
            warnings: warnings,
            lastGC: global.gc ? 'available' : 'not_available',
          },
        };
      } catch (error) {
        return {
          name: 'memory_pressure',
          status: 'unhealthy',
          responseTime: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Memory pressure check failed',
        };
      }
    });

    // Event loop lag check
    this.registerCheck('event_loop', async (): Promise<HealthCheckResult> => {
      const startTime = Date.now();
      
      return new Promise((resolve) => {
        const start = process.hrtime();
        
        setImmediate(() => {
          const delta = process.hrtime(start);
          const lagMs = (delta[0] * 1000) + (delta[1] * 1e-6);

          let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
          if (lagMs > 100) status = 'degraded';   // >100ms lag
          if (lagMs > 500) status = 'unhealthy';  // >500ms lag

          resolve({
            name: 'event_loop',
            status,
            responseTime: Date.now() - startTime,
            details: {
              lagMs: lagMs.toFixed(2),
              threshold: {
                degraded: '100ms',
                unhealthy: '500ms',
              },
            },
          });
        });
      });
    });
  }
}

// Global health checker instance
export const healthChecker = new HealthChecker();