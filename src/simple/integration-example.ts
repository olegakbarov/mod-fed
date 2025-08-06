/**
 * Integration example showing how to use the simple authentication system
 * with the existing API server structure.
 */

import express from 'express';
import helmet from 'helmet';
import { appConfig, createToken, authenticate, apiLimiter, strictLimiter, authLimiter } from './index';

/**
 * Creates an Express app with the simple authentication system integrated.
 * This can be used to replace or enhance existing authentication logic.
 */
export function createAppWithSimpleAuth(): express.Application {
  const app = express();

  // Security middleware (always first)
  app.use(helmet());
  
  // Body parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Rate limiting by route type
  app.use('/api/auth/', authLimiter);  // Strict limits for auth endpoints
  app.use('/api/ai/', strictLimiter);  // Strict limits for AI endpoints
  app.use('/api/', apiLimiter);        // General limits for API endpoints

  // Public routes (no authentication required)
  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    
    // In a real app, validate against database with hashed passwords
    if (username && password) {
      // Create a JWT token valid for 24 hours
      const token = createToken(username, '24h');
      
      res.json({
        success: true,
        token,
        user: { id: username, username },
        expiresIn: '24h'
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Username and password are required'
      });
    }
  });

  // Protected routes (authentication required)
  app.use('/api/protected', authenticate);

  // Example protected endpoints
  app.get('/api/protected/profile', (req: any, res) => {
    res.json({
      success: true,
      user: req.user,
      message: 'This is a protected endpoint'
    });
  });

  app.post('/api/protected/ai/generate', (req: any, res) => {
    const { prompt } = req.body;
    
    // This would integrate with your AI generation logic
    res.json({
      success: true,
      user: req.user,
      prompt,
      result: `Generated response for: ${prompt}`,
      timestamp: new Date().toISOString()
    });
  });

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      config: {
        port: appConfig.port,
        environment: appConfig.nodeEnv
      }
    });
  });

  return app;
}

/**
 * Start the server if this file is run directly.
 */
if (require.main === module) {
  const app = createAppWithSimpleAuth();
  
  app.listen(appConfig.port, () => {
    console.log(`🚀 Server with simple auth running on port ${appConfig.port}`);
    console.log(`📊 Environment: ${appConfig.nodeEnv}`);
    console.log(`🔒 Authentication: JWT tokens`);
    console.log(`⚡ Rate limiting: Enabled`);
    console.log('');
    console.log('Example requests:');
    console.log(`curl -X POST http://localhost:${appConfig.port}/api/auth/login -H "Content-Type: application/json" -d '{"username":"demo","password":"password"}'`);
    console.log(`curl http://localhost:${appConfig.port}/health`);
  });
}