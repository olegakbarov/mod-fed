// Jest setup file for global test configuration

// Mock console methods to avoid noise in tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
  log: jest.fn(),
};

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.AI_PROVIDER = 'openai';
process.env.AI_MODEL = 'gpt-4o-mini';

// Global test utilities
global.testUtils = {
  createMockRequest: (options = {}) => {
    const defaults = {
      method: 'GET',
      url: 'http://localhost:3002/',
      headers: new Map(),
    };
    
    return {
      ...defaults,
      ...options,
      headers: new Map(Object.entries(options.headers || {})),
    };
  },
  
  createMockResponse: () => {
    const response = {
      json: jest.fn(),
      text: jest.fn(),
      headers: new Map(),
      status: 200,
    };
    
    response.json.mockResolvedValue({});
    response.text.mockResolvedValue('');
    
    return response;
  },
  
  delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
};

// Increase timeout for integration tests
jest.setTimeout(30000);