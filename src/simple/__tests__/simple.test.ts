/**
 * Tests for the simple authentication and configuration system.
 */

describe('Simple Authentication System', () => {
  beforeAll(() => {
    // Set required environment variables for testing
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-unit-tests';
    process.env.DATABASE_PATH = './test.db';
  });

  describe('Config', () => {
    it('should load configuration with required environment variables', () => {
      // Import after setting env vars
      const { appConfig } = require('../config');
      
      expect(appConfig.jwtSecret).toBe('test-jwt-secret-key-for-unit-tests');
      expect(appConfig.databasePath).toBe('./test.db');
      expect(appConfig.port).toBe(3000); // Default value
      expect(appConfig.nodeEnv).toBe('test'); // Set by Jest
    });

    it('should throw error if JWT_SECRET is missing', () => {
      const originalSecret = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;
      
      const { loadConfig } = require('../config');
      
      expect(() => {
        loadConfig();
      }).toThrow('JWT_SECRET environment variable is required');
      
      // Restore for other tests
      process.env.JWT_SECRET = originalSecret;
    });
  });

  describe('Auth', () => {
    let auth: any;

    beforeAll(() => {
      // Import after env vars are set
      auth = require('../auth');
    });

    it('should create and verify valid JWT tokens', () => {
      const userId = 'test-user-123';
      const token = auth.createToken(userId);
      
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
      
      const payload = auth.verifyToken(token);
      expect(payload).toBeTruthy();
      expect(payload!.userId).toBe(userId);
    });

    it('should return null for invalid tokens', () => {
      const payload = auth.verifyToken('invalid-token');
      expect(payload).toBeNull();
    });

    it('should return null for expired tokens', () => {
      const userId = 'test-user-123';
      // Create token that expires immediately
      const token = auth.createToken(userId, '0s');
      
      // Wait a bit to ensure expiration
      setTimeout(() => {
        const payload = auth.verifyToken(token);
        expect(payload).toBeNull();
      }, 100);
    });
  });

  describe('Rate Limiting', () => {
    it('should export rate limiters', () => {
      const rateLimits = require('../rate-limit');
      
      expect(rateLimits.apiLimiter).toBeDefined();
      expect(rateLimits.strictLimiter).toBeDefined();
      expect(rateLimits.authLimiter).toBeDefined();
      expect(typeof rateLimits.createCustomLimiter).toBe('function');
    });

    it('should create custom rate limiter', () => {
      const { createCustomLimiter } = require('../rate-limit');
      
      const customLimiter = createCustomLimiter(50, 10 * 60 * 1000, 'Custom limit exceeded');
      expect(customLimiter).toBeDefined();
    });
  });
});