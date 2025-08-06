// Mock implementations for testing

// Mock AI SDK
export const mockAI = {
  generateObject: jest.fn(),
  openai: jest.fn(),
  createOpenAI: jest.fn(() => jest.fn()),
  anthropic: jest.fn(),
  createAnthropic: jest.fn(() => jest.fn()),
};

// Mock Database
export class MockDatabase {
  private data = new Map<string, any[]>();
  private lastId = 0;

  run(query: string, ...params: any[]) {
    this.lastId++;
    
    if (query.includes('INSERT')) {
      return {
        lastInsertRowid: this.lastId,
        changes: 1,
      };
    }
    
    if (query.includes('UPDATE') || query.includes('DELETE')) {
      return {
        changes: 1,
      };
    }
    
    return {
      changes: 0,
    };
  }

  query(sql: string) {
    return {
      get: jest.fn(() => ({
        id: this.lastId,
        name: 'Mock App',
        spec: '{"appName":"Mock App"}',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })),
      all: jest.fn(() => [
        {
          id: 1,
          name: 'Mock App 1',
          spec: '{"appName":"Mock App 1"}',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 2,
          name: 'Mock App 2',
          spec: '{"appName":"Mock App 2"}',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]),
    };
  }

  prepare(sql: string) {
    return {
      run: (...params: any[]) => this.run(sql, ...params),
      get: jest.fn(),
      all: jest.fn(),
    };
  }

  close() {
    return true;
  }
}

// Mock Metrics Collector
export const mockMetricsCollector = {
  recordMetric: jest.fn(),
  recordRequest: jest.fn(),
  recordGeneration: jest.fn(),
  recordCache: jest.fn(),
  recordSystem: jest.fn(),
  
  getRequestStats: jest.fn(() => ({
    totalRequests: 100,
    successRate: 95.5,
    averageResponseTime: 250,
    errorRate: 4.5,
    requestsPerMinute: 10,
    statusCodeDistribution: {
      '2xx': 85,
      '4xx': 10,
      '5xx': 5,
    },
    topEndpoints: [
      { path: '/api/generate', count: 50 },
      { path: '/api/apps', count: 25 },
      { path: '/api/data/todos', count: 20 },
    ],
  })),
  
  getGenerationStats: jest.fn(() => ({
    totalGenerations: 50,
    successRate: 92.0,
    averageResponseTime: 2500,
    fallbackRate: 8.0,
    providerDistribution: {
      'openai': 30,
      'anthropic': 20,
    },
    averageTokenUsage: 150,
    errorsCount: 4,
  })),
  
  getCacheStats: jest.fn(() => ({
    totalOperations: 200,
    hitRate: 65.0,
    missRate: 35.0,
    operationDistribution: {
      'hit': 130,
      'miss': 70,
      'set': 50,
      'evict': 5,
    },
  })),
  
  getSystemStats: jest.fn(() => ({
    cpuUsage: 45.2,
    memoryUsage: {
      used: 256 * 1024 * 1024,
      total: 512 * 1024 * 1024,
      percentage: 50.0,
    },
    activeConnections: 12,
    timestamp: Date.now(),
  })),
  
  getDetailedMetrics: jest.fn(() => ({
    requests: mockMetricsCollector.getRequestStats(),
    generations: mockMetricsCollector.getGenerationStats(),
    cache: mockMetricsCollector.getCacheStats(),
    system: mockMetricsCollector.getSystemStats(),
    timestamp: Date.now(),
  })),
  
  isHealthy: jest.fn(() => true),
  getPrometheusMetrics: jest.fn(() => 'mock_metric 1.0'),
};

// Mock Logger
export const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  fatal: jest.fn(),
  
  request: jest.fn(),
  generation: jest.fn(),
  security: jest.fn(),
  performance: jest.fn(),
  cache: jest.fn(),
  database: jest.fn(),
  
  createChildLogger: jest.fn(() => mockLogger),
  getRecentLogs: jest.fn(() => []),
  getLogsByLevel: jest.fn(() => []),
  getLogsByCorrelationId: jest.fn(() => []),
  
  isHealthy: jest.fn(() => true),
  getLogMetrics: jest.fn(() => ({
    totalLogs: 1000,
    logsByLevel: {
      'DEBUG': 200,
      'INFO': 600,
      'WARN': 150,
      'ERROR': 45,
      'FATAL': 5,
    },
    recentErrorCount: 3,
    bufferUtilization: 25.5,
  })),
};

// Mock Cache
export const mockCache = {
  get: jest.fn(() => null),
  set: jest.fn(),
  delete: jest.fn(() => true),
  clear: jest.fn(),
  findSimilar: jest.fn(() => []),
  
  getStats: jest.fn(() => ({
    entries: 50,
    size: 10 * 1024 * 1024, // 10MB
    maxSize: 50 * 1024 * 1024, // 50MB
    utilization: 20.0,
    hitRate: 65.0,
    missRate: 35.0,
    oldestEntry: Date.now() - 3600000, // 1 hour ago
    newestEntry: Date.now() - 60000, // 1 minute ago
    averageAccessCount: 3.5,
  })),
  
  getDetailedStats: jest.fn(() => ({
    config: {
      maxSize: 50 * 1024 * 1024,
      defaultTTL: 3600000,
      maxEntries: 1000,
      enableMetrics: true,
      enableCompression: false,
    },
    stats: mockCache.getStats(),
    entries: [],
  })),
  
  isHealthy: jest.fn(() => true),
  destroy: jest.fn(),
};

// Mock Health Checker
export const mockHealthChecker = {
  registerCheck: jest.fn(),
  unregisterCheck: jest.fn(),
  
  checkHealth: jest.fn(() => Promise.resolve({
    status: 'healthy' as const,
    timestamp: new Date().toISOString(),
    uptime: 3600000, // 1 hour
    version: '1.0.0',
    environment: 'test',
    checks: [
      {
        name: 'database',
        status: 'healthy' as const,
        responseTime: 50,
        details: { type: 'sqlite', testPassed: true },
      },
      {
        name: 'metrics',
        status: 'healthy' as const,
        responseTime: 25,
        details: { isCollecting: true },
      },
      {
        name: 'logger',
        status: 'healthy' as const,
        responseTime: 15,
        details: { isWorking: true },
      },
      {
        name: 'cache',
        status: 'healthy' as const,
        responseTime: 20,
        details: { isWorking: true, utilization: 20.0 },
      },
      {
        name: 'ai_provider',
        status: 'degraded' as const,
        responseTime: 10,
        details: { hasApiKey: false, mode: 'fallback' },
      },
      {
        name: 'memory',
        status: 'healthy' as const,
        responseTime: 5,
        details: { heapUsed: '128.50MB', utilization: '25.0%' },
      },
    ],
    summary: {
      total: 6,
      healthy: 5,
      unhealthy: 0,
      degraded: 1,
    },
  })),
  
  quickCheck: jest.fn(() => Promise.resolve({
    status: 'healthy' as const,
    responseTime: 100,
  })),
};

// Mock Rate Limiter
export const mockRateLimiter = {
  checkLimit: jest.fn(() => ({
    isAllowed: true,
    headers: {
      'X-RateLimit-Limit': '100',
      'X-RateLimit-Remaining': '99',
      'X-RateLimit-Reset': Date.now() + 3600000,
    },
  })),
  
  getStats: jest.fn(() => ({
    totalRequests: 1000,
    rateLimitedRequests: 25,
    uniqueIPs: 50,
    averageRequestsPerMinute: 16.7,
  })),
};

// Mock Auth Middleware
export const mockAuthMiddleware = {
  authenticate: jest.fn(() => ({
    isAuthenticated: false,
    keyInfo: null,
  })),
};

// Mock Validation Middleware
export const mockValidationMiddleware = {
  validateRequestBody: jest.fn(async (req: Request) => ({
    isValid: true,
    data: await req.json().catch(() => ({})),
    sanitizedData: await req.json().catch(() => ({})),
  })),
  
  validateGenerateRequest: jest.fn((data) => ({
    isValid: true,
    sanitizedData: data,
    errors: [],
  })),
  
  validateDataRequest: jest.fn((data) => ({
    isValid: true,
    sanitizedData: data,
    errors: [],
  })),
};

// Mock Error Classes
export class MockAIAppGeneratorError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly retryable: boolean;
  public readonly timestamp: number;
  public readonly correlationId?: string;
  public readonly context?: Record<string, any>;

  constructor(
    message: string,
    code: string = 'MOCK_ERROR',
    statusCode: number = 500,
    retryable: boolean = false,
    correlationId?: string,
    context?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = retryable;
    this.timestamp = Date.now();
    this.correlationId = correlationId;
    this.context = context;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      retryable: this.retryable,
      timestamp: this.timestamp,
      correlationId: this.correlationId,
      context: this.context,
    };
  }
}

// Mock Utility Functions
export const mockUtils = {
  generateCorrelationId: jest.fn(() => `mock-correlation-${Date.now()}`),
  extractCorrelationId: jest.fn(() => 'mock-correlation-id'),
  getClientIP: jest.fn(() => '127.0.0.1'),
  sanitizeErrorForLogging: jest.fn((error) => ({
    name: error.name,
    message: error.message,
    stack: error.stack,
    timestamp: Date.now(),
  })),
  sanitizeErrorForResponse: jest.fn((error) => ({
    error: error.message,
    timestamp: new Date().toISOString(),
  })),
};

// Test Helpers
export const testHelpers = {
  createMockRequest: (options: Partial<Request> = {}): Request => {
    const defaults = {
      method: 'GET',
      url: 'http://localhost:3002/test',
      headers: new Headers({
        'content-type': 'application/json',
        'user-agent': 'Test/1.0',
      }),
      json: jest.fn().mockResolvedValue({}),
      text: jest.fn().mockResolvedValue(''),
    };

    return { ...defaults, ...options } as unknown as Request;
  },

  createMockResponse: (): Response => {
    const response = {
      json: jest.fn(),
      text: jest.fn(),
      status: 200,
      headers: new Headers(),
      ok: true,
    };

    response.json.mockResolvedValue({});
    response.text.mockResolvedValue('');

    return response as unknown as Response;
  },

  delay: (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  waitFor: async (condition: () => boolean, timeout: number = 5000): Promise<void> => {
    const start = Date.now();
    while (!condition() && Date.now() - start < timeout) {
      await testHelpers.delay(10);
    }
    if (!condition()) {
      throw new Error('Condition not met within timeout');
    }
  },

  expectEventually: async (
    assertion: () => void | Promise<void>,
    timeout: number = 5000
  ): Promise<void> => {
    const start = Date.now();
    let lastError: Error | undefined;

    while (Date.now() - start < timeout) {
      try {
        await assertion();
        return; // Success
      } catch (error) {
        lastError = error as Error;
        await testHelpers.delay(100);
      }
    }

    throw lastError || new Error('Assertion failed within timeout');
  },
};

// Reset all mocks
export const resetAllMocks = (): void => {
  jest.clearAllMocks();
  
  // Reset mock implementations to defaults
  Object.values(mockMetricsCollector).forEach(mock => {
    if (jest.isMockFunction(mock)) {
      mock.mockClear();
    }
  });
  
  Object.values(mockLogger).forEach(mock => {
    if (jest.isMockFunction(mock)) {
      mock.mockClear();
    }
  });
  
  Object.values(mockCache).forEach(mock => {
    if (jest.isMockFunction(mock)) {
      mock.mockClear();
    }
  });
  
  Object.values(mockUtils).forEach(mock => {
    if (jest.isMockFunction(mock)) {
      mock.mockClear();
    }
  });
};