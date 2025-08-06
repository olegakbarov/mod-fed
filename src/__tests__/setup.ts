/**
 * Jest test setup file
 * This file runs before all tests to set up the testing environment
 */

// Mock React Native components and modules that don't work in Node environment
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
  StyleSheet: {
    create: jest.fn(() => ({})),
  },
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  TextInput: 'TextInput',
  ScrollView: 'ScrollView',
  FlatList: 'FlatList',
  Image: 'Image',
  Alert: {
    alert: jest.fn(),
  },
  Dimensions: {
    get: jest.fn(() => ({ width: 375, height: 812 })),
  },
}));

// Mock console methods for cleaner test output
global.console = {
  ...console,
  // Suppress console.log during tests but keep error and warn
  log: jest.fn(),
  debug: jest.fn(),
  // Keep error and warn for important debugging
  error: console.error,
  warn: console.warn,
  info: jest.fn(),
};

// Setup global test utilities
global.mockImplementation = (fn: any) => fn;

// Mock fetch for API-related tests
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    headers: new Map(),
    status: 200,
    statusText: 'OK',
  })
) as jest.Mock;

// Mock timers
jest.useFakeTimers();

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  jest.resetAllMocks();
});

// Set up test environment variables
process.env.NODE_ENV = 'test';
process.env.API_BASE_URL = 'http://localhost:3002';
process.env.COMPONENT_SERVER_URL = 'http://localhost:3001';