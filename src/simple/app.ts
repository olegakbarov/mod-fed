import express from 'express';
import helmet from 'helmet';
import crypto from 'crypto';
import { authenticate, createToken } from './auth';
import { apiLimiter, strictLimiter, authLimiter } from './rate-limit';
import { SimpleBunDatabase } from './database-bun';
import { generateApp } from './ai-service';

const app = express();

// Initialize database
const db = new SimpleBunDatabase();

// Security middleware
app.use(helmet());
app.use(express.json({ limit: '1mb' }));

// Trust proxy for rate limiting behind reverse proxies
app.set('trust proxy', 1);

// Health check endpoint (no rate limiting, no auth)
app.get('/health', (req, res) => {
  try {
    // Simple database health check
    const result = db.queries.getUserById.get(1);
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      version: '1.0.0'
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'error',
      error: 'Database connection failed'
    });
  }
});

// Auth endpoints with strict rate limiting
app.post('/auth/register', authLimiter, async (req, res) => {
  try {
    const { email, name, password } = req.body;

    // Basic validation
    if (!email || !name || !password) {
      return res.status(400).json({
        error: 'Email, name, and password are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'Password must be at least 6 characters long'
      });
    }

    // Check if user already exists
    const existingUser = db.userHelpers.getByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        error: 'User with this email already exists'
      });
    }

    // Hash password using crypto (simple approach)
    const salt = crypto.randomBytes(16).toString('hex');
    const hashedPassword = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    const passwordHash = `${salt}:${hashedPassword}`;

    // Create user (note: we're storing password hash in name field for simplicity)
    // In production, you'd have a separate password field
    const result = db.userHelpers.create(email, `${name}:${passwordHash}`);
    const userId = result.lastInsertRowid.toString();

    // Generate token
    const token = createToken(userId);

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: userId,
        email,
        name
      }
    });

  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

app.post('/auth/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    // Get user
    const user = db.userHelpers.getByEmail(email);
    if (!user) {
      return res.status(401).json({
        error: 'Invalid credentials'
      });
    }

    // Extract password hash from name field (simplified approach)
    const [name, passwordHash] = (user as any).name.split(':');
    if (!passwordHash) {
      return res.status(401).json({
        error: 'Invalid credentials'
      });
    }

    // Verify password
    const [salt, hash] = passwordHash.split(':');
    const testHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    const isValidPassword = hash === testHash;
    
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Invalid credentials'
      });
    }

    // Generate token
    const token = createToken((user as any).id.toString());

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: (user as any).id,
        email: (user as any).email,
        name
      }
    });

  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// Protected API endpoints
app.use('/api', apiLimiter); // Apply general rate limiting to all API routes

// Get user's apps
app.get('/api/apps', authenticate, (req, res) => {
  try {
    const userId = parseInt((req as any).user.userId);
    const apps = db.appHelpers.getUserApps(userId);

    res.json({
      apps: apps.map((app: any) => ({
        id: app.id,
        name: app.name,
        createdAt: app.created_at,
        updatedAt: app.updated_at
      }))
    });

  } catch (error: any) {
    console.error('Get apps error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// Generate new app with AI (strict rate limit)
app.post('/api/generate', strictLimiter, authenticate, async (req, res) => {
  try {
    const { prompt } = req.body;
    const userId = parseInt((req as any).user.userId);

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({
        error: 'Prompt is required and must be a non-empty string'
      });
    }

    if (prompt.length > 1000) {
      return res.status(400).json({
        error: 'Prompt is too long (max 1000 characters)'
      });
    }

    // Generate app with AI
    const appSpec = await generateApp(prompt);
    
    // Store in database
    const result = db.appHelpers.create(
      appSpec.appName,
      JSON.stringify(appSpec),
      userId
    );

    const appId = result.lastInsertRowid;

    res.status(201).json({
      message: 'App generated successfully',
      app: {
        id: appId,
        name: appSpec.appName,
        spec: appSpec
      }
    });

  } catch (error: any) {
    console.error('Generate app error:', error);
    
    // Provide more specific error messages
    if (error.message.includes('API key')) {
      return res.status(503).json({
        error: 'AI service temporarily unavailable'
      });
    }

    if (error.message.includes('Circuit')) {
      return res.status(503).json({
        error: 'AI service overloaded, please try again later'
      });
    }

    res.status(500).json({
      error: 'Failed to generate app'
    });
  }
});

// Get specific app
app.get('/api/apps/:id', authenticate, (req, res) => {
  try {
    const appId = parseInt(req.params.id);
    const userId = parseInt((req as any).user.userId);

    if (isNaN(appId)) {
      return res.status(400).json({
        error: 'Invalid app ID'
      });
    }

    const app = db.appHelpers.getById(appId);
    
    if (!app) {
      return res.status(404).json({
        error: 'App not found'
      });
    }

    // Check ownership
    if ((app as any).user_id !== userId) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    res.json({
      app: {
        id: (app as any).id,
        name: (app as any).name,
        spec: JSON.parse((app as any).spec),
        createdAt: (app as any).created_at,
        updatedAt: (app as any).updated_at
      }
    });

  } catch (error: any) {
    console.error('Get app error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// Delete app
app.delete('/api/apps/:id', authenticate, (req, res) => {
  try {
    const appId = parseInt(req.params.id);
    const userId = parseInt((req as any).user.userId);

    if (isNaN(appId)) {
      return res.status(400).json({
        error: 'Invalid app ID'
      });
    }

    // Check if app exists and user owns it
    const app = db.appHelpers.getById(appId);
    if (!app) {
      return res.status(404).json({
        error: 'App not found'
      });
    }

    if ((app as any).user_id !== userId) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    // Delete app
    const result = db.appHelpers.delete(appId, userId);
    
    if (result.changes === 0) {
      return res.status(404).json({
        error: 'App not found'
      });
    }

    res.json({
      message: 'App deleted successfully'
    });

  } catch (error: any) {
    console.error('Delete app error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({
    error: 'Endpoint not found'
  });
});

// Global error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error);
  
  res.status(500).json({
    error: 'Internal server error'
  });
});

export default app;
export { db };