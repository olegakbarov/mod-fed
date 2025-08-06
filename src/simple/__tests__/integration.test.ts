import request from 'supertest';
import { beforeAll, beforeEach, afterAll, describe, test, expect, jest } from '@jest/globals';
import app from '../app';
import { SimpleBunDatabase } from '../database-bun';
import { createToken, verifyToken } from '../auth';
import * as fs from 'fs';
import * as path from 'path';

// Mock the AI service to avoid external API calls during testing
jest.mock('../ai-service', () => ({
  generateApp: jest.fn().mockResolvedValue({
    appName: 'Test Todo App',
    description: 'A simple todo list application',
    components: ['Header', 'List', 'TextInput'],
    screens: [
      {
        name: 'TodoList',
        components: ['Header', 'List', 'TextInput'],
        layout: {
          type: 'column',
          spacing: 16
        }
      }
    ],
    theme: {
      primaryColor: '#007AFF',
      backgroundColor: '#FFFFFF'
    }
  })
}));

describe('Simple Solution Integration Tests', () => {
  let db: SimpleBunDatabase;
  let testDbPath: string;
  let testUserId: string;
  let testUserToken: string;
  let secondUserId: string;
  let secondUserToken: string;

  beforeAll(() => {
    // Create a test database
    testDbPath = path.join(__dirname, '..', '..', '..', 'test-integration.db');
    process.env.DATABASE_PATH = testDbPath;
    process.env.JWT_SECRET = 'test-secret-for-integration-tests-only';
    process.env.NODE_ENV = 'test';
  });

  beforeEach(async () => {
    // Clean up any existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    if (fs.existsSync(`${testDbPath}-shm`)) {
      fs.unlinkSync(`${testDbPath}-shm`);
    }
    if (fs.existsSync(`${testDbPath}-wal`)) {
      fs.unlinkSync(`${testDbPath}-wal`);
    }

    // Initialize fresh database for each test
    db = new SimpleBunDatabase(testDbPath);
  });

  afterAll(() => {
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    if (fs.existsSync(`${testDbPath}-shm`)) {
      fs.unlinkSync(`${testDbPath}-shm`);
    }
    if (fs.existsSync(`${testDbPath}-wal`)) {
      fs.unlinkSync(`${testDbPath}-wal`);
    }
  });

  describe('Health Check', () => {
    test('should return healthy status when database is working', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'healthy',
        database: 'connected',
        version: '1.0.0'
      });
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('Authentication Flow', () => {
    test('should register a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        name: 'Test User',
        password: 'password123'
      };

      const response = await request(app)
        .post('/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body).toMatchObject({
        message: 'User registered successfully',
        user: {
          email: userData.email,
          name: userData.name
        }
      });
      expect(response.body.token).toBeDefined();
      expect(response.body.user.id).toBeDefined();

      // Verify token is valid
      const payload = verifyToken(response.body.token);
      expect(payload).toBeTruthy();
      expect(payload?.userId).toBe(response.body.user.id);

      testUserId = response.body.user.id;
      testUserToken = response.body.token;
    });

    test('should reject registration with invalid data', async () => {
      // Missing email
      await request(app)
        .post('/auth/register')
        .send({ name: 'Test User', password: 'password123' })
        .expect(400);

      // Short password
      await request(app)
        .post('/auth/register')
        .send({ email: 'test@example.com', name: 'Test User', password: '123' })
        .expect(400);

      // Missing name
      await request(app)
        .post('/auth/register')
        .send({ email: 'test@example.com', password: 'password123' })
        .expect(400);
    });

    test('should prevent duplicate user registration', async () => {
      const userData = {
        email: 'duplicate@example.com',
        name: 'First User',
        password: 'password123'
      };

      // First registration should succeed
      await request(app)
        .post('/auth/register')
        .send(userData)
        .expect(201);

      // Second registration with same email should fail
      await request(app)
        .post('/auth/register')
        .send({ ...userData, name: 'Second User' })
        .expect(409);
    });

    test('should login with valid credentials', async () => {
      // First register a user
      const userData = {
        email: 'login@example.com',
        name: 'Login User',
        password: 'password123'
      };

      await request(app)
        .post('/auth/register')
        .send(userData)
        .expect(201);

      // Then login
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: userData.email,
          password: userData.password
        })
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Login successful',
        user: {
          email: userData.email,
          name: userData.name
        }
      });
      expect(response.body.token).toBeDefined();
    });

    test('should reject login with invalid credentials', async () => {
      // Register user first
      await request(app)
        .post('/auth/register')
        .send({
          email: 'logintest@example.com',
          name: 'Login Test',
          password: 'correctpassword'
        });

      // Wrong password
      await request(app)
        .post('/auth/login')
        .send({
          email: 'logintest@example.com',
          password: 'wrongpassword'
        })
        .expect(401);

      // Non-existent user
      await request(app)
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'anypassword'
        })
        .expect(401);
    });
  });

  describe('Authorization', () => {
    beforeEach(async () => {
      // Register two test users
      const user1Response = await request(app)
        .post('/auth/register')
        .send({
          email: 'user1@example.com',
          name: 'User One',
          password: 'password123'
        });

      const user2Response = await request(app)
        .post('/auth/register')
        .send({
          email: 'user2@example.com',
          name: 'User Two',
          password: 'password123'
        });

      testUserId = user1Response.body.user.id;
      testUserToken = user1Response.body.token;
      secondUserId = user2Response.body.user.id;
      secondUserToken = user2Response.body.token;
    });

    test('should reject requests without authentication token', async () => {
      await request(app)
        .get('/api/apps')
        .expect(401);

      await request(app)
        .post('/api/generate')
        .send({ prompt: 'Create a todo app' })
        .expect(401);
    });

    test('should reject requests with invalid token', async () => {
      await request(app)
        .get('/api/apps')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      await request(app)
        .get('/api/apps')
        .set('Authorization', 'Bearer ' + createToken('999', '1h'))
        .expect(401); // User doesn't exist
    });

    test('should allow access with valid token', async () => {
      const response = await request(app)
        .get('/api/apps')
        .set('Authorization', 'Bearer ' + testUserToken)
        .expect(200);

      expect(response.body).toHaveProperty('apps');
      expect(Array.isArray(response.body.apps)).toBe(true);
    });

    test('should enforce user data isolation', async () => {
      // User 1 creates an app
      const generateResponse = await request(app)
        .post('/api/generate')
        .set('Authorization', 'Bearer ' + testUserToken)
        .send({ prompt: 'Create a todo app' })
        .expect(201);

      const appId = generateResponse.body.app.id;

      // User 1 can access their app
      await request(app)
        .get(`/api/apps/${appId}`)
        .set('Authorization', 'Bearer ' + testUserToken)
        .expect(200);

      // User 2 cannot access User 1's app
      await request(app)
        .get(`/api/apps/${appId}`)
        .set('Authorization', 'Bearer ' + secondUserToken)
        .expect(403);

      // User 2 cannot delete User 1's app
      await request(app)
        .delete(`/api/apps/${appId}`)
        .set('Authorization', 'Bearer ' + secondUserToken)
        .expect(403);

      // User 2's app list should be empty
      const user2AppsResponse = await request(app)
        .get('/api/apps')
        .set('Authorization', 'Bearer ' + secondUserToken)
        .expect(200);

      expect(user2AppsResponse.body.apps).toHaveLength(0);
    });
  });

  describe('Rate Limiting', () => {
    beforeEach(async () => {
      // Register a test user
      const userResponse = await request(app)
        .post('/auth/register')
        .send({
          email: 'ratetest@example.com',
          name: 'Rate Test User',
          password: 'password123'
        });

      testUserToken = userResponse.body.token;
    });

    test('should enforce auth rate limiting', async () => {
      // Auth endpoints have a limit of 5 requests per 15 minutes
      const promises = [];
      
      // Make 6 requests to exceed the limit
      for (let i = 0; i < 6; i++) {
        promises.push(
          request(app)
            .post('/auth/login')
            .send({
              email: 'nonexistent@example.com',
              password: 'wrongpassword'
            })
        );
      }

      const responses = await Promise.all(promises);
      
      // First 5 should get through (even with 401 auth errors)
      for (let i = 0; i < 5; i++) {
        expect([401, 429]).toContain(responses[i].status);
      }
      
      // 6th request should be rate limited
      expect(responses[5].status).toBe(429);
    });

    test('should enforce API rate limiting', async () => {
      // General API endpoints have higher limits (100 per 15 min)
      // But strict endpoints (AI generation) have lower limits (10 per 15 min)
      const promises = [];
      
      // Make 11 requests to AI generation endpoint
      for (let i = 0; i < 11; i++) {
        promises.push(
          request(app)
            .post('/api/generate')
            .set('Authorization', 'Bearer ' + testUserToken)
            .send({ prompt: `Create app ${i}` })
        );
      }

      const responses = await Promise.all(promises);
      
      // Check that we eventually hit rate limit
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Complete Application Flow', () => {
    test('should handle complete user journey: register → login → generate app → get apps → delete app', async () => {
      // 1. Register user
      const registerResponse = await request(app)
        .post('/auth/register')
        .send({
          email: 'journey@example.com',
          name: 'Journey User',
          password: 'password123'
        })
        .expect(201);

      const token = registerResponse.body.token;
      
      // 2. Generate an app
      const generateResponse = await request(app)
        .post('/api/generate')
        .set('Authorization', 'Bearer ' + token)
        .send({ prompt: 'Create a todo list app with priorities' })
        .expect(201);

      expect(generateResponse.body).toMatchObject({
        message: 'App generated successfully',
        app: {
          name: 'Test Todo App',
          spec: {
            appName: 'Test Todo App',
            description: 'A simple todo list application',
            components: ['Header', 'List', 'TextInput']
          }
        }
      });

      const appId = generateResponse.body.app.id;

      // 3. Get user's apps
      const appsResponse = await request(app)
        .get('/api/apps')
        .set('Authorization', 'Bearer ' + token)
        .expect(200);

      expect(appsResponse.body.apps).toHaveLength(1);
      expect(appsResponse.body.apps[0]).toMatchObject({
        id: appId,
        name: 'Test Todo App'
      });

      // 4. Get specific app
      const appResponse = await request(app)
        .get(`/api/apps/${appId}`)
        .set('Authorization', 'Bearer ' + token)
        .expect(200);

      expect(appResponse.body.app).toMatchObject({
        id: appId,
        name: 'Test Todo App',
        spec: {
          appName: 'Test Todo App',
          components: ['Header', 'List', 'TextInput']
        }
      });

      // 5. Delete the app
      await request(app)
        .delete(`/api/apps/${appId}`)
        .set('Authorization', 'Bearer ' + token)
        .expect(200);

      // 6. Verify app is deleted
      const emptyAppsResponse = await request(app)
        .get('/api/apps')
        .set('Authorization', 'Bearer ' + token)
        .expect(200);

      expect(emptyAppsResponse.body.apps).toHaveLength(0);

      // 7. Try to access deleted app
      await request(app)
        .get(`/api/apps/${appId}`)
        .set('Authorization', 'Bearer ' + token)
        .expect(404);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      const userResponse = await request(app)
        .post('/auth/register')
        .send({
          email: 'error@example.com',
          name: 'Error Test User',
          password: 'password123'
        });

      testUserToken = userResponse.body.token;
    });

    test('should handle invalid app generation requests', async () => {
      // Empty prompt
      await request(app)
        .post('/api/generate')
        .set('Authorization', 'Bearer ' + testUserToken)
        .send({ prompt: '' })
        .expect(400);

      // Missing prompt
      await request(app)
        .post('/api/generate')
        .set('Authorization', 'Bearer ' + testUserToken)
        .send({})
        .expect(400);

      // Prompt too long
      const longPrompt = 'a'.repeat(1001);
      await request(app)
        .post('/api/generate')
        .set('Authorization', 'Bearer ' + testUserToken)
        .send({ prompt: longPrompt })
        .expect(400);
    });

    test('should handle invalid app ID requests', async () => {
      // Invalid app ID format
      await request(app)
        .get('/api/apps/invalid')
        .set('Authorization', 'Bearer ' + testUserToken)
        .expect(400);

      // Non-existent app ID
      await request(app)
        .get('/api/apps/99999')
        .set('Authorization', 'Bearer ' + testUserToken)
        .expect(404);

      // Delete non-existent app
      await request(app)
        .delete('/api/apps/99999')
        .set('Authorization', 'Bearer ' + testUserToken)
        .expect(404);
    });

    test('should handle 404 for unknown endpoints', async () => {
      await request(app)
        .get('/unknown/endpoint')
        .expect(404);

      await request(app)
        .post('/api/unknown')
        .set('Authorization', 'Bearer ' + testUserToken)
        .expect(404);
    });
  });

  describe('Security Headers and Validation', () => {
    test('should include security headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Helmet adds these security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('0');
    });

    test('should validate JSON payload limits', async () => {
      const userResponse = await request(app)
        .post('/auth/register')
        .send({
          email: 'limit@example.com',
          name: 'Limit Test',
          password: 'password123'
        });

      const token = userResponse.body.token;

      // Large payload should be rejected (limit is 1mb)
      const largePayload = {
        prompt: 'Create an app',
        extraData: 'x'.repeat(2 * 1024 * 1024) // 2MB
      };

      await request(app)
        .post('/api/generate')
        .set('Authorization', 'Bearer ' + token)
        .send(largePayload)
        .expect(413); // Payload too large
    });
  });

  describe('Database Persistence', () => {
    test('should persist data across requests', async () => {
      // Register user
      const userResponse = await request(app)
        .post('/auth/register')
        .send({
          email: 'persist@example.com',
          name: 'Persist User',
          password: 'password123'
        });

      const token = userResponse.body.token;

      // Generate app
      await request(app)
        .post('/api/generate')
        .set('Authorization', 'Bearer ' + token)
        .send({ prompt: 'Create a dashboard app' });

      // Create new database instance (simulates server restart)
      const newDb = new SimpleBunDatabase(testDbPath);

      // Data should still be accessible
      const users = newDb.db.query('SELECT * FROM users WHERE email = ?').all('persist@example.com');
      expect(users).toHaveLength(1);

      const apps = newDb.db.query('SELECT * FROM apps WHERE user_id = ?').all((users[0] as any).id);
      expect(apps).toHaveLength(1);

      // API should still work with persisted data
      const appsResponse = await request(app)
        .get('/api/apps')
        .set('Authorization', 'Bearer ' + token)
        .expect(200);

      expect(appsResponse.body.apps).toHaveLength(1);
    });
  });
});