/**
 * Comprehensive tests for config service
 */

import {
  loadConfig,
  isProduction,
  isDevelopment,
  getFeature,
  getApiConfig,
  getAIConfig,
  defaultConfig,
  AppConfig
} from '../config';

// Mock validation utilities
jest.mock('../../utils/validation', () => ({
  TypeGuards: {
    isString: jest.fn((value: any): value is string => typeof value === 'string'),
    isNumber: jest.fn((value: any): value is number => typeof value === 'number' && !isNaN(value)),
    isObject: jest.fn((value: any): value is Record<string, unknown> => 
      typeof value === 'object' && value !== null && !Array.isArray(value)
    )
  }
}));

describe('Config Service', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let originalNavigator: any;

  beforeEach(() => {
    // Store original environment
    originalEnv = process.env;
    originalNavigator = (global as any).navigator;

    // Reset environment for each test
    process.env = { ...originalEnv };
    delete process.env.NODE_ENV;
    delete process.env.API_BASE_URL;
    delete process.env.COMPONENT_SERVER_URL;

    // Reset React Native detection
    delete (global as any).navigator;

    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    (global as any).navigator = originalNavigator;
  });

  describe('loadConfig', () => {
    it('should load default config in Node.js environment', () => {
      const config = loadConfig();

      expect(config).toMatchObject({
        version: '1.0.0',
        environment: 'development',
        features: {
          hotReload: true,
          aiIntegration: true,
          databaseEnabled: true,
          remoteComponents: false
        },
        api: {
          baseUrl: 'http://localhost:3002',
          timeout: 30000
        },
        componentServer: {
          url: 'http://localhost:3001',
          port: 3001,
          fallbackToLocal: true
        },
        ai: {
          provider: 'local',
          maxTokens: 2000
        }
      });
    });

    it('should load React Native config when in React Native environment', () => {
      // Mock React Native environment
      (global as any).navigator = { product: 'ReactNative' };

      const config = loadConfig();

      expect(config.environment).toBe('production');
      expect(config.features.hotReload).toBe(false);
      expect(config.api.baseUrl).toBe('https://api.example.com');
      expect(config.componentServer.url).toBe('https://components.example.com');
    });

    it('should apply environment overrides from NODE_ENV', () => {
      process.env.NODE_ENV = 'production';

      const config = loadConfig();

      expect(config.environment).toBe('production');
    });

    it('should apply environment overrides from API_BASE_URL', () => {
      process.env.API_BASE_URL = 'https://custom-api.com';

      const config = loadConfig();

      expect(config.api.baseUrl).toBe('https://custom-api.com');
    });

    it('should apply environment overrides from COMPONENT_SERVER_URL', () => {
      process.env.COMPONENT_SERVER_URL = 'https://custom-components.com';

      const config = loadConfig();

      expect(config.componentServer.url).toBe('https://custom-components.com');
    });

    it('should apply multiple environment overrides', () => {
      process.env.NODE_ENV = 'staging';
      process.env.API_BASE_URL = 'https://staging-api.com';
      process.env.COMPONENT_SERVER_URL = 'https://staging-components.com';

      const config = loadConfig();

      expect(config.environment).toBe('staging');
      expect(config.api.baseUrl).toBe('https://staging-api.com');
      expect(config.componentServer.url).toBe('https://staging-components.com');
    });

    it('should not apply environment overrides in React Native', () => {
      // Mock React Native environment
      (global as any).navigator = { product: 'ReactNative' };
      
      // These should be ignored in React Native
      process.env.NODE_ENV = 'development';
      process.env.API_BASE_URL = 'http://localhost:3000';

      const config = loadConfig();

      // Should use React Native defaults, not env overrides
      expect(config.environment).toBe('production');
      expect(config.api.baseUrl).toBe('https://api.example.com');
    });

    it('should return default config when validation fails', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      // Mock validation to fail
      const mockValidation = require('../../utils/validation');
      mockValidation.TypeGuards.isString.mockReturnValue(false);

      const config = loadConfig();

      // Should still return a valid config
      expect(config).toBeDefined();
      expect(config.version).toBe('1.0.0');
      expect(consoleSpy).toHaveBeenCalledWith('Config validation failed, using defaults');
      
      consoleSpy.mockRestore();
    });

    it('should handle errors gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Mock validation to throw an error
      const mockValidation = require('../../utils/validation');
      mockValidation.TypeGuards.isString.mockImplementation(() => {
        throw new Error('Validation error');
      });

      const config = loadConfig();

      // Should return default config
      expect(config).toBeDefined();
      expect(config.version).toBe('1.0.0');
      expect(consoleSpy).toHaveBeenCalledWith('Error loading config:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });

    it('should validate config structure correctly', () => {
      const config = loadConfig();

      // Check all required properties exist
      expect(config).toHaveProperty('version');
      expect(config).toHaveProperty('environment');
      expect(config).toHaveProperty('features');
      expect(config).toHaveProperty('api');
      expect(config).toHaveProperty('componentServer');
      expect(config).toHaveProperty('ai');

      // Check nested structure
      expect(config.features).toHaveProperty('hotReload');
      expect(config.features).toHaveProperty('aiIntegration');
      expect(config.features).toHaveProperty('databaseEnabled');
      expect(config.features).toHaveProperty('remoteComponents');

      expect(config.api).toHaveProperty('baseUrl');
      expect(config.api).toHaveProperty('timeout');

      expect(config.componentServer).toHaveProperty('url');
      expect(config.componentServer).toHaveProperty('port');
      expect(config.componentServer).toHaveProperty('fallbackToLocal');

      expect(config.ai).toHaveProperty('provider');
    });
  });

  describe('helper functions', () => {
    describe('isProduction', () => {
      it('should return true for production environment', () => {
        const config: AppConfig = {
          ...loadConfig(),
          environment: 'production'
        };

        expect(isProduction(config)).toBe(true);
      });

      it('should return false for non-production environments', () => {
        const devConfig: AppConfig = {
          ...loadConfig(),
          environment: 'development'
        };

        const stagingConfig: AppConfig = {
          ...loadConfig(),
          environment: 'staging'
        };

        expect(isProduction(devConfig)).toBe(false);
        expect(isProduction(stagingConfig)).toBe(false);
      });
    });

    describe('isDevelopment', () => {
      it('should return true for development environment', () => {
        const config: AppConfig = {
          ...loadConfig(),
          environment: 'development'
        };

        expect(isDevelopment(config)).toBe(true);
      });

      it('should return false for non-development environments', () => {
        const prodConfig: AppConfig = {
          ...loadConfig(),
          environment: 'production'
        };

        const stagingConfig: AppConfig = {
          ...loadConfig(),
          environment: 'staging'
        };

        expect(isDevelopment(prodConfig)).toBe(false);
        expect(isDevelopment(stagingConfig)).toBe(false);
      });
    });

    describe('getFeature', () => {
      const mockConfig: AppConfig = {
        ...loadConfig(),
        features: {
          hotReload: true,
          aiIntegration: false,
          databaseEnabled: true,
          remoteComponents: false
        }
      };

      it('should return correct feature values', () => {
        expect(getFeature(mockConfig, 'hotReload')).toBe(true);
        expect(getFeature(mockConfig, 'aiIntegration')).toBe(false);
        expect(getFeature(mockConfig, 'databaseEnabled')).toBe(true);
        expect(getFeature(mockConfig, 'remoteComponents')).toBe(false);
      });

      it('should handle all feature keys', () => {
        const features: (keyof AppConfig['features'])[] = [
          'hotReload',
          'aiIntegration',
          'databaseEnabled',
          'remoteComponents'
        ];

        features.forEach(feature => {
          expect(typeof getFeature(mockConfig, feature)).toBe('boolean');
        });
      });
    });

    describe('getApiConfig', () => {
      it('should return a copy of API config', () => {
        const config = loadConfig();
        const apiConfig = getApiConfig(config);

        expect(apiConfig).toEqual(config.api);
        expect(apiConfig).not.toBe(config.api); // Should be a different object
      });

      it('should contain all API config properties', () => {
        const config = loadConfig();
        const apiConfig = getApiConfig(config);

        expect(apiConfig).toHaveProperty('baseUrl');
        expect(apiConfig).toHaveProperty('timeout');
        expect(typeof apiConfig.baseUrl).toBe('string');
        expect(typeof apiConfig.timeout).toBe('number');
      });

      it('should be immutable', () => {
        const config = loadConfig();
        const apiConfig = getApiConfig(config);
        const originalTimeout = apiConfig.timeout;

        apiConfig.timeout = 999999;

        // Original config should not be affected
        expect(config.api.timeout).toBe(originalTimeout);
        expect(getApiConfig(config).timeout).toBe(originalTimeout);
      });
    });

    describe('getAIConfig', () => {
      it('should return a copy of AI config', () => {
        const config = loadConfig();
        const aiConfig = getAIConfig(config);

        expect(aiConfig).toEqual(config.ai);
        expect(aiConfig).not.toBe(config.ai); // Should be a different object
      });

      it('should contain all AI config properties', () => {
        const config = loadConfig();
        const aiConfig = getAIConfig(config);

        expect(aiConfig).toHaveProperty('provider');
        expect(typeof aiConfig.provider).toBe('string');
        
        if (aiConfig.maxTokens !== undefined) {
          expect(typeof aiConfig.maxTokens).toBe('number');
        }
        
        if (aiConfig.apiKey !== undefined) {
          expect(typeof aiConfig.apiKey).toBe('string');
        }
      });

      it('should be immutable', () => {
        const config = loadConfig();
        const aiConfig = getAIConfig(config);
        const originalProvider = aiConfig.provider;

        aiConfig.provider = 'modified' as any;

        // Original config should not be affected
        expect(config.ai.provider).toBe(originalProvider);
        expect(getAIConfig(config).provider).toBe(originalProvider);
      });
    });
  });

  describe('defaultConfig', () => {
    it('should be a valid config object', () => {
      expect(defaultConfig).toBeDefined();
      expect(defaultConfig).toHaveProperty('version');
      expect(defaultConfig).toHaveProperty('environment');
      expect(defaultConfig).toHaveProperty('features');
      expect(defaultConfig).toHaveProperty('api');
      expect(defaultConfig).toHaveProperty('componentServer');
      expect(defaultConfig).toHaveProperty('ai');
    });

    it('should match the output of loadConfig() in clean environment', () => {
      // Reset environment to ensure clean state
      const cleanConfig = loadConfig();
      
      // Should be equivalent (but not necessarily identical due to timing)
      expect(defaultConfig.version).toBe(cleanConfig.version);
      expect(defaultConfig.features).toEqual(cleanConfig.features);
      expect(defaultConfig.ai).toEqual(cleanConfig.ai);
    });
  });

  describe('platform detection', () => {
    it('should detect Node.js environment correctly', () => {
      delete (global as any).navigator;
      
      const config = loadConfig();
      
      expect(config.features.hotReload).toBe(true);
      expect(config.api.baseUrl).toBe('http://localhost:3002');
    });

    it('should detect React Native environment correctly', () => {
      (global as any).navigator = { product: 'ReactNative' };
      
      const config = loadConfig();
      
      expect(config.features.hotReload).toBe(false);
      expect(config.api.baseUrl).toBe('https://api.example.com');
      expect(config.environment).toBe('production');
    });

    it('should handle navigator with different product value', () => {
      (global as any).navigator = { product: 'Gecko' };
      
      const config = loadConfig();
      
      // Should treat as Node.js environment
      expect(config.features.hotReload).toBe(true);
      expect(config.api.baseUrl).toBe('http://localhost:3002');
    });

    it('should handle navigator without product property', () => {
      (global as any).navigator = {};
      
      const config = loadConfig();
      
      // Should treat as Node.js environment
      expect(config.features.hotReload).toBe(true);
      expect(config.api.baseUrl).toBe('http://localhost:3002');
    });
  });

  describe('configuration validation edge cases', () => {
    it('should handle partial config validation failure', () => {
      const mockValidation = require('../../utils/validation');
      
      // Mock specific validation failures
      mockValidation.TypeGuards.isString
        .mockReturnValueOnce(true) // version passes
        .mockReturnValueOnce(false); // environment fails
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const config = loadConfig();
      
      expect(consoleSpy).toHaveBeenCalledWith('Config validation failed, using defaults');
      expect(config).toBeDefined();
      
      consoleSpy.mockRestore();
    });

    it('should handle config with missing nested properties', () => {
      // This tests the internal validation logic
      const config = loadConfig();
      
      // All nested properties should exist
      expect(config.features).toBeDefined();
      expect(config.api).toBeDefined();
      expect(config.componentServer).toBeDefined();
      expect(config.ai).toBeDefined();
    });
  });

  describe('environment-specific configurations', () => {
    it('should have different defaults for React Native vs Node', () => {
      // Test Node.js config
      delete (global as any).navigator;
      const nodeConfig = loadConfig();
      
      // Test React Native config
      (global as any).navigator = { product: 'ReactNative' };
      const rnConfig = loadConfig();
      
      // Should be different
      expect(nodeConfig.environment).toBe('development');
      expect(rnConfig.environment).toBe('production');
      
      expect(nodeConfig.features.hotReload).toBe(true);
      expect(rnConfig.features.hotReload).toBe(false);
      
      expect(nodeConfig.api.baseUrl).toContain('localhost');
      expect(rnConfig.api.baseUrl).toContain('example.com');
    });

    it('should handle staging environment correctly', () => {
      process.env.NODE_ENV = 'staging';
      
      const config = loadConfig();
      
      expect(config.environment).toBe('staging');
      expect(['development', 'staging', 'production']).toContain(config.environment);
    });
  });

  describe('immutability and side effects', () => {
    it('should not modify global state', () => {
      const originalProcess = process.env;
      
      loadConfig();
      
      expect(process.env).toBe(originalProcess);
    });

    it('should return new config objects on each call', () => {
      const config1 = loadConfig();
      const config2 = loadConfig();
      
      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2);
      expect(config1.features).not.toBe(config2.features);
      expect(config1.api).not.toBe(config2.api);
    });

    it('should handle concurrent loadConfig calls', () => {
      const promises = Array.from({ length: 10 }, () => 
        Promise.resolve(loadConfig())
      );
      
      return Promise.all(promises).then(configs => {
        // All configs should be valid and equivalent
        configs.forEach(config => {
          expect(config).toBeDefined();
          expect(config.version).toBe('1.0.0');
        });
        
        // But should be different objects
        const firstConfig = configs[0];
        configs.slice(1).forEach(config => {
          expect(config).toEqual(firstConfig);
          expect(config).not.toBe(firstConfig);
        });
      });
    });
  });
});