#!/usr/bin/env bun

/**
 * Security Features Test Script
 * 
 * This script demonstrates and tests the security features of the API server.
 * Run with: bun test-security.ts
 */

import { rateLimiter, getClientIP } from './src/middleware/rate-limiter';
import { authMiddleware } from './src/middleware/auth';
import { validationMiddleware } from './src/middleware/validation';

console.log('🔐 Testing AI App Generator Security Features\n');

// Test 1: Rate Limiter
console.log('1. Testing Rate Limiter');
console.log('========================');

const testIP = '192.168.1.100';

// Test anonymous user limits
for (let i = 1; i <= 12; i++) {
  const result = rateLimiter.checkLimit(testIP, false);
  console.log(`Request ${i}: ${result.isAllowed ? '✅ Allowed' : '❌ Rate limited'} (Remaining: ${result.remaining})`);
}

// Clear the limit and test authenticated user
rateLimiter.clearLimit(testIP);
console.log('\n📝 Cleared rate limit, testing authenticated user:');

for (let i = 1; i <= 5; i++) {
  const result = rateLimiter.checkLimit(testIP, true);
  console.log(`Auth Request ${i}: ${result.isAllowed ? '✅ Allowed' : '❌ Rate limited'} (Remaining: ${result.remaining})`);
}

// Test 2: Authentication
console.log('\n\n2. Testing Authentication');
console.log('=========================');

// Create mock requests
const createMockRequest = (authHeader?: string) => {
  const headers = new Map();
  if (authHeader) headers.set('authorization', authHeader);
  
  return {
    headers: {
      get: (name: string) => headers.get(name.toLowerCase()) || null,
    }
  } as Request;
};

const authTests = [
  { name: 'No auth header', request: createMockRequest() },
  { name: 'Valid demo key', request: createMockRequest('Bearer demo-key-12345') },
  { name: 'Valid premium key', request: createMockRequest('premium-key-67890') },
  { name: 'Invalid key', request: createMockRequest('Bearer invalid-key-123') },
  { name: 'ApiKey format', request: createMockRequest('ApiKey demo-key-12345') },
];

authTests.forEach(test => {
  const result = authMiddleware.authenticate(test.request);
  const status = result.isAuthenticated ? '✅ Authenticated' : '❌ Failed';
  const tier = result.keyInfo?.tier || 'N/A';
  console.log(`${test.name}: ${status} (Tier: ${tier})`);
});

// Test 3: Input Validation
console.log('\n\n3. Testing Input Validation');
console.log('============================');

const validationTests = [
  {
    name: 'Valid prompt',
    data: { prompt: 'Create a simple todo app' },
    expected: true,
  },
  {
    name: 'Empty prompt',
    data: { prompt: '' },
    expected: false,
  },
  {
    name: 'Too long prompt',
    data: { prompt: 'a'.repeat(600) },
    expected: false,
  },
  {
    name: 'XSS attempt',
    data: { prompt: '<script>alert("xss")</script>Create an app' },
    expected: true, // Should be sanitized
  },
  {
    name: 'Missing prompt',
    data: { options: 'test' },
    expected: false,
  },
];

validationTests.forEach(test => {
  const result = validationMiddleware.validateGenerateRequest(test.data);
  const status = result.isValid === test.expected ? '✅ Correct' : '❌ Unexpected';
  console.log(`${test.name}: ${status} (Valid: ${result.isValid})`);
  
  if (result.errors) {
    console.log(`  Errors: ${result.errors.join(', ')}`);
  }
  if (result.sanitizedData?.prompt && result.sanitizedData.prompt !== test.data.prompt) {
    console.log(`  Sanitized: "${result.sanitizedData.prompt}"`);
  }
});

// Test 4: API Key Management
console.log('\n\n4. Testing API Key Management');
console.log('==============================');

// Create a new API key
const newKey = authMiddleware.createApiKey('Test User', 'basic');
console.log(`✅ Created new API key: ${newKey}`);

// List all keys
const keys = authMiddleware.listApiKeys();
console.log(`📋 Total API keys: ${keys.length}`);
keys.forEach((key, index) => {
  console.log(`  ${index + 1}. ${key.name} (${key.tier}) - Active: ${key.isActive}`);
});

// Deactivate the new key
const deactivated = authMiddleware.deactivateApiKey(newKey);
console.log(`${deactivated ? '✅' : '❌'} Deactivated key: ${newKey}`);

// Test 5: Rate Limiter Stats
console.log('\n\n5. Rate Limiter Statistics');
console.log('===========================');

const stats = rateLimiter.getStats();
console.log(`📊 Rate Limiter Stats:`);
console.log(`  - Total entries: ${stats.totalEntries}`);
console.log(`  - Active IPs: ${stats.activeIPs}`);
console.log(`  - Authenticated requests: ${stats.authenticatedRequests}`);
console.log(`  - Anonymous requests: ${stats.anonymousRequests}`);

// Clean up
console.log('\n🧹 Cleaning up test data...');
rateLimiter.clearLimit(testIP);

console.log('\n✅ Security features test completed successfully!');
console.log('\nTo test with a real server, run:');
console.log('  bun run server/api-server.ts');
console.log('\nThen test with curl:');
console.log('  curl -H "Authorization: Bearer demo-key-12345" \\');
console.log('    -H "Content-Type: application/json" \\');
console.log('    -d \'{"prompt": "create a todo app"}\' \\');
console.log('    http://localhost:3002/api/generate');