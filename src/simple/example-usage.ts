/**
 * Example usage of the simple authentication and configuration system.
 * This file demonstrates how to integrate the simple modules into an Express app.
 */

import express from 'express';
import helmet from 'helmet';
import { appConfig, createToken, authenticate, apiLimiter, strictLimiter, authLimiter } from './index';

const app = express();

// Security middleware
app.use(helmet());
app.use(express.json());

// Rate limiting
app.use('/api/', apiLimiter);
app.use('/api/ai/', strictLimiter);
app.use('/auth/', authLimiter);

// Example: Login endpoint (public)
app.post('/auth/login', (req, res) => {
  const { username, password } = req.body;
  
  // Simple validation (in production, hash and compare passwords properly)
  if (username === 'demo' && password === 'password') {
    const token = createToken('user123');
    res.json({ token, userId: 'user123' });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// Example: Protected endpoint
app.get('/api/user/profile', authenticate, (req: any, res) => {
  res.json({ 
    message: 'This is a protected endpoint',
    userId: req.user.userId 
  });
});

// Example: AI endpoint with strict rate limiting
app.post('/api/ai/generate', authenticate, (req: any, res) => {
  res.json({ 
    message: 'AI generation endpoint',
    userId: req.user.userId,
    result: 'Generated content...' 
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    config: {
      port: appConfig.port,
      nodeEnv: appConfig.nodeEnv,
      databasePath: appConfig.databasePath
    }
  });
});

// Start server
if (require.main === module) {
  app.listen(appConfig.port, () => {
    console.log(`Server running on port ${appConfig.port} in ${appConfig.nodeEnv} mode`);
  });
}

export default app;