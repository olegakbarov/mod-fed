// Sample prompts for testing AI generation
export const testPrompts = {
  todo: [
    'Create a todo app',
    'I need a task manager',
    'Build a TODO list application',
    'Make an app for managing tasks',
    'Create a simple todo list',
    'I want to track my daily tasks',
  ],
  
  dashboard: [
    'Create a dashboard',
    'I need analytics dashboard',
    'Build a dashboard application',
    'Create a metrics dashboard',
    'I want to see my data visualizations',
    'Make a reporting dashboard',
  ],
  
  blog: [
    'Create a blog app',
    'I need an article management system',
    'Build a blog platform',
    'Create a content management system',
    'I want to publish articles',
    'Make a blogging platform',
  ],
  
  generic: [
    'Create a simple app',
    'Build something useful',
    'I need a mobile application',
    'Create an app for my business',
    'Build a prototype app',
  ],
  
  complex: [
    'Create a comprehensive project management tool with tasks, teams, and deadlines',
    'Build an e-commerce app with products, shopping cart, and checkout',
    'I need a social media app with posts, comments, and user profiles',
    'Create a fitness tracking app with workouts, nutrition, and progress monitoring',
  ],
  
  edge_cases: [
    '', // Empty prompt
    'a', // Single character
    'Create', // Single word
    'a'.repeat(1000), // Very long prompt
    'Create a todo app. Also make it beautiful. And fast. And secure. Please add authentication too.', // Multiple requirements
    '!@#$%^&*()_+{}|:"<>?[]\\;\',./', // Special characters
  ],
};

// Sample database records
export const sampleDatabaseData = {
  apps: [
    {
      id: 1,
      name: 'Test Todo App',
      spec: JSON.stringify({
        appName: 'Test Todo App',
        dataCollection: 'todos',
        enableDatabase: true,
        screens: [{ name: 'MainScreen', components: [] }],
      }),
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 2,
      name: 'Test Dashboard App',
      spec: JSON.stringify({
        appName: 'Test Dashboard App',
        screens: [{ name: 'DashboardScreen', components: [] }],
      }),
      created_at: '2024-01-02T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
    },
  ],
  
  todos: [
    {
      id: 1,
      collection: 'todos',
      data: JSON.stringify({ title: 'Test Todo 1', completed: false, priority: 'High' }),
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 2,
      collection: 'todos',
      data: JSON.stringify({ title: 'Test Todo 2', completed: true, priority: 'Medium' }),
      created_at: '2024-01-01T01:00:00Z',
      updated_at: '2024-01-01T02:00:00Z',
    },
    {
      id: 3,
      collection: 'todos',
      data: JSON.stringify({ title: 'Test Todo 3', completed: false, priority: 'Low' }),
      created_at: '2024-01-01T02:00:00Z',
      updated_at: '2024-01-01T02:00:00Z',
    },
  ],
  
  posts: [
    {
      id: 1,
      collection: 'posts',
      data: JSON.stringify({
        title: 'First Blog Post',
        content: 'This is the content of the first blog post.',
        tags: 'introduction,blog,first',
        published: true,
      }),
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 2,
      collection: 'posts',
      data: JSON.stringify({
        title: 'Second Blog Post',
        content: 'This is the content of the second blog post with more details.',
        tags: 'tutorial,guide,advanced',
        published: false,
      }),
      created_at: '2024-01-02T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
    },
  ],
};

// Sample request/response pairs for API testing
export const sampleApiRequests = {
  generate: {
    valid: [
      { prompt: 'Create a todo app' },
      { prompt: 'Build a dashboard' },
      { prompt: 'I need a blog platform' },
    ],
    invalid: [
      {}, // Missing prompt
      { prompt: '' }, // Empty prompt
      { prompt: null }, // Null prompt
      { prompt: 123 }, // Non-string prompt
    ],
  },
  
  apps: {
    valid: [
      {
        name: 'Test App',
        spec: {
          appName: 'Test App',
          screens: [{ name: 'MainScreen', components: [] }],
        },
      },
    ],
    invalid: [
      {}, // Missing fields
      { name: '' }, // Empty name
      { name: 'Test', spec: null }, // Invalid spec
    ],
  },
  
  data: {
    valid: [
      { title: 'Test Item', description: 'Test description' },
      { name: 'Sample Data', value: 123, active: true },
    ],
    invalid: [
      {}, // Empty object
      null, // Null data
      'not an object', // String instead of object
    ],
  },
};

// Sample error scenarios for testing
export const errorScenarios = {
  ai_provider: [
    {
      type: 'rate_limit',
      error: new Error('Rate limit exceeded'),
      expectedFallback: true,
    },
    {
      type: 'authentication',
      error: new Error('Invalid API key'),
      expectedFallback: true,
    },
    {
      type: 'timeout',
      error: new Error('Request timeout'),
      expectedFallback: true,
    },
    {
      type: 'invalid_response',
      error: new Error('Invalid response format'),
      expectedFallback: true,
    },
  ],
  
  database: [
    {
      type: 'connection_error',
      error: new Error('Database connection failed'),
      shouldRetry: true,
    },
    {
      type: 'constraint_violation',
      error: new Error('UNIQUE constraint failed'),
      shouldRetry: false,
    },
    {
      type: 'table_not_found',
      error: new Error('Table does not exist'),
      shouldRetry: false,
    },
  ],
  
  validation: [
    {
      type: 'missing_required_field',
      data: { name: '' },
      expectedErrors: ['Name is required'],
    },
    {
      type: 'invalid_data_type',
      data: { age: 'not a number' },
      expectedErrors: ['Age must be a number'],
    },
    {
      type: 'invalid_format',
      data: { email: 'invalid-email' },
      expectedErrors: ['Invalid email format'],
    },
  ],
};

// Sample metrics data for testing
export const sampleMetrics = {
  requests: [
    {
      method: 'GET',
      path: '/api/apps',
      statusCode: 200,
      responseTime: 150,
      timestamp: Date.now() - 60000,
      clientIP: '127.0.0.1',
      correlationId: 'test-correlation-1',
    },
    {
      method: 'POST',
      path: '/api/generate',
      statusCode: 200,
      responseTime: 2500,
      timestamp: Date.now() - 30000,
      clientIP: '127.0.0.1',
      correlationId: 'test-correlation-2',
    },
    {
      method: 'GET',
      path: '/api/data/todos',
      statusCode: 404,
      responseTime: 100,
      timestamp: Date.now() - 15000,
      clientIP: '192.168.1.1',
      correlationId: 'test-correlation-3',
      error: 'Collection not found',
    },
  ],
  
  generations: [
    {
      prompt: 'Create a todo app',
      success: true,
      responseTime: 2500,
      timestamp: Date.now() - 30000,
      provider: 'openai',
      model: 'gpt-4o-mini',
      fallbackUsed: false,
      tokenUsage: { promptTokens: 100, completionTokens: 200 },
      correlationId: 'test-correlation-2',
    },
    {
      prompt: 'Build a dashboard',
      success: false,
      responseTime: 5000,
      timestamp: Date.now() - 60000,
      provider: 'anthropic',
      model: 'claude-3-5-sonnet',
      fallbackUsed: true,
      correlationId: 'test-correlation-4',
      error: 'API rate limit exceeded',
    },
  ],
  
  cache: [
    {
      key: 'test-key-1',
      operation: 'miss' as const,
      timestamp: Date.now() - 45000,
    },
    {
      key: 'test-key-1',
      operation: 'set' as const,
      timestamp: Date.now() - 44000,
    },
    {
      key: 'test-key-1',
      operation: 'hit' as const,
      timestamp: Date.now() - 30000,
    },
  ],
};

// Sample configuration values for testing
export const testConfigurations = {
  development: {
    AI_PROVIDER: 'openai',
    AI_MODEL: 'gpt-4o-mini',
    AI_API_KEY: '',
    NODE_ENV: 'development',
    LOG_LEVEL: '1', // INFO
  },
  
  production: {
    AI_PROVIDER: 'anthropic',
    AI_MODEL: 'claude-3-5-sonnet-20241022',
    AI_API_KEY: 'test-api-key-123',
    NODE_ENV: 'production',
    LOG_LEVEL: '2', // WARN
  },
  
  test: {
    AI_PROVIDER: 'openai',
    AI_MODEL: 'gpt-4o-mini',
    AI_API_KEY: '',
    NODE_ENV: 'test',
    LOG_LEVEL: '0', // DEBUG
  },
};

// Utility functions for test data generation
export const testDataGenerators = {
  randomString: (length: number = 10): string => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },
  
  randomId: (): string => {
    return Math.random().toString(36).substr(2, 9);
  },
  
  randomTimestamp: (daysAgo: number = 7): number => {
    return Date.now() - Math.random() * daysAgo * 24 * 60 * 60 * 1000;
  },
  
  randomCorrelationId: (): string => {
    return `test-${Math.random().toString(36).substr(2, 16)}`;
  },
  
  generateMockRequest: (overrides: Partial<Request> = {}): Request => {
    const defaults = {
      method: 'GET',
      url: 'http://localhost:3002/test',
      headers: new Headers({
        'content-type': 'application/json',
        'user-agent': 'Test-Agent/1.0',
      }),
    };
    
    return {
      ...defaults,
      ...overrides,
    } as Request;
  },
  
  generateMockDatabaseData: (collection: string, count: number = 5) => {
    return Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      collection,
      data: JSON.stringify({
        title: `Test ${collection} ${i + 1}`,
        description: `Description for test ${collection} ${i + 1}`,
        createdBy: 'test-user',
        priority: ['Low', 'Medium', 'High'][i % 3],
      }),
      created_at: new Date(Date.now() - i * 60000).toISOString(),
      updated_at: new Date(Date.now() - i * 30000).toISOString(),
    }));
  },
};