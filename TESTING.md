# Testing Documentation

This document provides comprehensive testing guidance for the AI App Generator system, including practical examples, testing strategies, and best practices for ensuring system reliability.

## Test Structure

The test files are organized as follows:

```
src/
├── __tests__/
│   └── setup.ts                         # Jest setup and mocks
├── generators/__tests__/
│   └── simple-generator.test.ts          # Tests for SimpleAIGenerator class
└── services/__tests__/
    ├── components.test.ts                # Tests for component mapping functions
    ├── config.test.ts                   # Tests for config loading and helpers
    ├── index.test.ts                    # Tests for wrapper classes
    ├── rules.test.ts                    # Tests for rule application
    └── templates.test.ts                # Tests for template management
```

## Quick Start Testing Guide

### Essential Test Commands

```bash
# Run all tests (basic check)
bun test

# Run with detailed coverage report
bun test --coverage

# Watch mode for active development
bun test --watch

# Test specific generator functionality
bun run test:generator

# Test specific service
npx jest src/services/__tests__/templates.test.ts

# Run tests matching a pattern
bun test --testPathPattern="services"

# Verbose output for debugging
bun test --verbose
```

### Development Workflow

```bash
# 1. Start development with tests watching
Terminal 1: bun test --watch
Terminal 2: bun run component-server
Terminal 3: bun run ios

# 2. Make code changes and see tests auto-run
# 3. Check coverage when ready
bun test --coverage --coverageReporters=text-lcov,html,text

# 4. View detailed coverage report
open coverage/lcov-report/index.html
```

## Practical Testing Examples

### Testing Your Changes

```bash
# After making changes to the generator
bun test src/generators/__tests__/simple-generator.test.ts

# After modifying templates
bun test src/services/__tests__/templates.test.ts

# After updating components
bun test src/services/__tests__/components.test.ts

# Test everything related to services
bun test --testPathPattern="services"
```

### Writing New Tests

#### 1. Testing a New Template

```typescript
// src/templates/__tests__/my-template.test.ts
import { myCustomTemplate } from '../my-template';
import { interpolateTemplate } from '../services/templates';

describe('MyCustomTemplate', () => {
  test('has required properties', () => {
    expect(myCustomTemplate.id).toBe('my-custom');
    expect(myCustomTemplate.name).toBeDefined();
    expect(myCustomTemplate.keywords).toContain('custom');
    expect(myCustomTemplate.screens.length).toBeGreaterThan(0);
  });

  test('interpolates variables correctly', () => {
    const variables = { appTitle: 'Test App', customValue: 'Hello' };
    const result = interpolateTemplate(myCustomTemplate, variables);
    
    expect(JSON.stringify(result)).not.toContain('{{appTitle}}');
    expect(JSON.stringify(result)).toContain('Test App');
  });
});
```

#### 2. Testing a New Component

```typescript
// src/components/__tests__/MyComponent.test.tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { MyComponent } from '../MyComponent';

describe('MyComponent', () => {
  test('renders with required props', () => {
    const { getByText } = render(
      <MyComponent title="Test Title" />
    );
    
    expect(getByText('Test Title')).toBeTruthy();
  });

  test('handles optional props correctly', () => {
    const { getByTestId } = render(
      <MyComponent 
        title="Test" 
        subtitle="Subtitle"
        onPress={jest.fn()}
        testID="my-component"
      />
    );
    
    expect(getByTestId('my-component')).toBeTruthy();
  });
});
```

#### 3. Testing Custom Rules

```typescript
// src/services/__tests__/my-rules.test.ts
import { applyRules } from '../rules';

describe('Custom Rules', () => {
  test('applies custom business rule', () => {
    const components = [
      { type: 'Header', props: { title: 'Test' } },
      { type: 'BusinessForm', props: { fields: [] } }
    ];

    const context = { 
      userIntent: 'business',
      hasCustomerData: true 
    };

    const result = applyRules(components, context);
    
    // Should add customer management components
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'CustomerList' })
      ])
    );
  });
});
```

### Coverage Reports

Generate and view coverage reports:
```bash
# Generate HTML coverage report
bun test --coverage --coverageReporters=html,text

# View in browser
open coverage/lcov-report/index.html

# Terminal-only coverage
bun test --coverage --coverageReporters=text
```

The HTML coverage report will be generated in `coverage/lcov-report/index.html`.

## Test Coverage

The test suite achieves **>98% coverage** on the core system components:

| File | Statements | Branches | Functions | Lines |
|------|------------|----------|-----------|-------|
| `services/templates.ts` | 100% | 100% | 100% | 100% |
| `services/rules.ts` | 100% | 85.71% | 100% | 100% |
| `services/index.ts` | 100% | 100% | 100% | 100% |
| `services/components.ts` | 97.61% | 92.85% | 100% | 96.77% |
| `services/config.ts` | 92.85% | 89.28% | 100% | 92.85% |
| `generators/simple-generator.ts` | 100% | 87.27% | 100% | 100% |

## What's Tested

### SimpleAIGenerator (`simple-generator.test.ts`)
- ✅ Complete app generation workflow
- ✅ Keyword extraction from prompts
- ✅ Template selection logic
- ✅ Custom app name extraction
- ✅ Template customization
- ✅ Rule application and optimization
- ✅ Intent determination
- ✅ Fallback app generation
- ✅ Error handling and recovery

### Templates Service (`templates.test.ts`)
- ✅ Template retrieval by ID
- ✅ Getting all available templates
- ✅ Finding templates by keywords
- ✅ Best template matching with scoring
- ✅ Template interpolation with variables
- ✅ Nested object and array interpolation
- ✅ Edge cases and malformed data handling

### Rules Service (`rules.test.ts`)
- ✅ Default rule application (database, mobile limit, header-first, grid-cards)
- ✅ Rule condition evaluation
- ✅ Component filtering and transformation
- ✅ Custom rule addition and execution
- ✅ Error handling in rule execution
- ✅ Multiple rule application in sequence

### Components Service (`components.test.ts`)
- ✅ Component lookup by type
- ✅ Finding components by AI tags with scoring
- ✅ Keyword-based component search
- ✅ Category-based component filtering
- ✅ Intent-based component mapping
- ✅ Component validation
- ✅ Performance testing for large queries

### Config Service (`config.test.ts`)
- ✅ Default configuration loading
- ✅ Environment-specific configurations
- ✅ Environment variable overrides
- ✅ Platform detection (Node.js vs React Native)
- ✅ Configuration validation
- ✅ Helper functions (isProduction, getFeature, etc.)
- ✅ Immutability and side effect prevention

### Index Service (`index.test.ts`)
- ✅ Wrapper class functionality
- ✅ Backward compatibility with original API
- ✅ Integration between services
- ✅ Instance independence
- ✅ Error handling and edge cases

## Test Features

### Comprehensive Mocking
- React Native components and APIs
- External dependencies
- Environment variables
- Console methods (with selective mocking)

### Edge Case Testing
- Invalid input handling
- Error conditions
- Empty/null data
- Large data sets
- Unicode and special characters
- Performance under load

### Integration Testing
- Service interaction workflows
- End-to-end generation process
- Error propagation and recovery

### Maintainability
- Clear test descriptions
- Grouped test cases by functionality
- Reusable mock data
- Comprehensive error testing

## Configuration

The test environment is configured via:
- `jest.config.js` - Main Jest configuration
- `src/__tests__/setup.ts` - Test environment setup and global mocks

### Key Configuration Features
- React Native preset for component compatibility
- Babel transformation for TypeScript
- Coverage thresholds (80% minimum)
- Mock setup for platform-specific code
- Timeout configuration for long-running tests

## Best Practices

The test suite follows these best practices:

1. **Isolation**: Each test is independent with proper setup/teardown
2. **Clarity**: Descriptive test names and clear assertions
3. **Coverage**: High code coverage with meaningful tests
4. **Edge Cases**: Comprehensive testing of error conditions
5. **Performance**: Tests for scalability and memory usage
6. **Maintainability**: Well-organized and documented test code

## Adding New Tests

When adding new tests:

1. Follow the existing file structure and naming conventions
2. Include comprehensive edge case testing
3. Mock external dependencies appropriately
4. Test both success and failure scenarios
5. Maintain or improve the coverage percentage
6. Add clear documentation for complex test scenarios

## Testing Best Practices

### 1. Test Structure and Organization

```typescript
describe('ServiceName', () => {
  // Group related tests
  describe('primary functionality', () => {
    test('handles normal case correctly', () => {
      // Arrange
      const input = createValidInput();
      
      // Act
      const result = serviceFunction(input);
      
      // Assert
      expect(result).toMatchExpectedOutput();
    });
  });

  describe('error handling', () => {
    test('gracefully handles invalid input', () => {
      const result = serviceFunction(null);
      expect(result).toBeNull();
    });
  });

  describe('edge cases', () => {
    test('works with empty input', () => {
      // Test boundary conditions
    });
  });
});
```

### 2. Mock Strategy

```typescript
// Good: Mock at the service boundary
jest.mock('../services/external-api', () => ({
  fetchData: jest.fn(),
  postData: jest.fn()
}));

// Good: Use factory functions for complex mocks
const createMockTemplate = (overrides = {}) => ({
  id: 'test-template',
  name: 'Test Template',
  keywords: ['test'],
  screens: [],
  ...overrides
});
```

### 3. Async Testing Patterns

```typescript
// ✅ Good: Proper async handling
test('generator handles async template loading', async () => {
  const generator = new SimpleAIGenerator();
  const result = await generator.generateApp('test prompt');
  expect(result).toBeDefined();
});

// ✅ Good: Test error conditions
test('handles network failures gracefully', async () => {
  // Mock network failure
  jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));
  
  const result = await generator.generateApp('test');
  expect(result).toBeDefined(); // Should return fallback
});
```

### 4. Performance Testing

```typescript
test('template matching performs within acceptable limits', () => {
  const startTime = Date.now();
  const keywords = Array(100).fill('test'); // Large input
  
  const result = findBestTemplate(keywords);
  const duration = Date.now() - startTime;
  
  expect(duration).toBeLessThan(50); // Should complete in <50ms
  expect(result).toBeDefined();
});
```

## Debugging Tests

### Common Issues and Solutions

#### 1. React Native Compatibility Issues

```bash
# Error: Cannot resolve module 'react-native'
# Solution: Check jest.config.js setup
{
  "preset": "react-native",
  "setupFilesAfterEnv": ["<rootDir>/src/__tests__/setup.ts"]
}
```

#### 2. Mock-related Problems

```typescript
// Problem: Mocks not working
// Solution: Ensure mocks are properly configured
beforeEach(() => {
  jest.clearAllMocks(); // Clear previous test state
});

// Problem: Real modules still executing
// Solution: Hoist mocks to the top of the file
jest.mock('../services/api');
```

#### 3. Async Test Failures

```typescript
// Problem: Test finishes before async operation
test('async operation completes', async () => {
  // ❌ Wrong: Missing await
  const result = generator.generateApp('test');
  
  // ✅ Correct: Proper await
  const result = await generator.generateApp('test');
  expect(result).toBeDefined();
});
```

#### 4. Coverage Issues

```bash
# Problem: Coverage suddenly drops
# Debug steps:
1. Check if new files are added without tests
2. Verify test files are in correct locations  
3. Run with verbose output: bun test --verbose
4. Check coverage exclusions in jest.config.js
```

### Debugging Commands

```bash
# Debug specific test
bun test --testNamePattern="specific test name" --verbose

# Run single test file with debugging
node --inspect-brk ./node_modules/.bin/jest src/services/__tests__/templates.test.ts

# Check what files Jest is finding
bun test --listTests

# Verbose output for debugging
bun test --verbose --no-coverage

# Debug test setup
bun test --setupFilesAfterEnv --verbose
```

## Advanced Testing Scenarios

### Integration Testing

```typescript
// Test full generation pipeline
test('end-to-end generation workflow', async () => {
  const generator = new SimpleAIGenerator();
  
  // Test various prompts
  const prompts = [
    'Create a todo app',
    'Build a dashboard',
    'Make a blog reader',
    'Invalid prompt!!!',
    '', // Empty prompt
  ];
  
  for (const prompt of prompts) {
    const result = await generator.generateApp(prompt);
    
    // All prompts should return valid specs
    expect(result.appName).toBeDefined();
    expect(result.screens.length).toBeGreaterThan(0);
    expect(result.screens[0].components.length).toBeGreaterThan(0);
  }
});
```

### Performance Regression Testing

```typescript
describe('Performance Benchmarks', () => {
  test('template matching stays under performance budget', () => {
    const trials = 100;
    const durations: number[] = [];
    
    for (let i = 0; i < trials; i++) {
      const start = performance.now();
      findBestTemplate(['todo', 'productivity']);
      durations.push(performance.now() - start);
    }
    
    const averageDuration = durations.reduce((a, b) => a + b) / trials;
    const maxDuration = Math.max(...durations);
    
    expect(averageDuration).toBeLessThan(10); // <10ms average
    expect(maxDuration).toBeLessThan(50);     // <50ms max
  });
});
```

### Memory Leak Testing

```typescript
test('generator does not leak memory', async () => {
  const initialMemory = process.memoryUsage().heapUsed;
  const generator = new SimpleAIGenerator();
  
  // Run many generations
  for (let i = 0; i < 100; i++) {
    await generator.generateApp('test prompt');
  }
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
  
  const finalMemory = process.memoryUsage().heapUsed;
  const memoryIncrease = finalMemory - initialMemory;
  
  // Memory increase should be reasonable (<10MB)
  expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
});
```

## Continuous Integration Testing

### GitHub Actions Configuration

```yaml
# .github/workflows/test.yml
name: Test Suite
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      
      - name: Install dependencies
        run: bun install
        
      - name: Run tests with coverage
        run: bun test --coverage
        
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
```

### Pre-commit Testing

```bash
# .husky/pre-commit
#!/bin/sh
bun test --passWithNoTests
bun run typecheck
bun run lint
```

This enhanced testing documentation provides practical guidance for testing the AI App Generator system effectively, with real-world examples and debugging strategies.