module.exports = {
  preset: 'react-native',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        '@babel/preset-typescript',
        'module:metro-react-native-babel-preset',
      ],
    }],
  },
  testMatch: [
    '**/__tests__/**/*.(js|jsx|ts|tsx)',
    '**/*.(test|spec).(js|jsx|ts|tsx)',
  ],
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    'server/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.{js,ts}',
    '!server/**/index.{js,ts}',
    '!**/__tests__/**',
    '!**/node_modules/**',
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  coverageDirectory: 'coverage',
  testTimeout: 10000,
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@server/(.*)$': '<rootDir>/server/$1',
  },
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json',
    },
  },
  // Mock Bun-specific modules
  moduleNameMapping: {
    '^bun$': '<rootDir>/__mocks__/bun.js',
    '^bun:sqlite$': '<rootDir>/__mocks__/bun-sqlite.js',
  },
};