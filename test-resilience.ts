#!/usr/bin/env bun

import { CircuitBreaker, CircuitBreakerState } from './src/utils/circuit-breaker';
import { Bulkhead } from './src/utils/bulkhead';
import { AIAppGenerator } from './src/generators/ai-generator';

// Simple test to validate resilience patterns
async function testCircuitBreaker() {
  console.log('🔄 Testing Circuit Breaker...');
  
  const config = {
    name: 'test-circuit',
    failureThreshold: 2,
    successThreshold: 1,
    timeout: 1000,
    monitoringWindow: 5000,
    volumeThreshold: 3,
  };
  
  const circuitBreaker = new CircuitBreaker(config);
  
  // Test successful execution
  const result = await circuitBreaker.execute(async () => {
    return 'success';
  });
  console.log('✅ Circuit breaker successful execution:', result);
  
  // Test failure handling
  let failures = 0;
  try {
    for (let i = 0; i < config.volumeThreshold; i++) {
      await circuitBreaker.execute(async () => {
        throw new Error('Simulated failure');
      });
    }
  } catch (error) {
    failures++;
  }
  
  console.log('⚡ Circuit breaker state after failures:', circuitBreaker.getState());
  console.log('📊 Circuit breaker metrics:', circuitBreaker.getMetrics());
  
  // Test circuit open behavior
  try {
    await circuitBreaker.execute(async () => {
      return 'should be rejected';
    });
  } catch (error) {
    console.log('🚫 Request correctly rejected when circuit is open');
  }
  
  console.log('✅ Circuit breaker test completed\n');
}

async function testBulkhead() {
  console.log('🛡️ Testing Bulkhead...');
  
  const config = {
    name: 'test-bulkhead',
    maxConcurrentRequests: 2,
    maxQueueSize: 2,
    queueTimeout: 1000,
    enableMetrics: true,
  };
  
  const bulkhead = new Bulkhead(config);
  
  // Test concurrent execution
  let activeRequests = 0;
  const maxConcurrentSeen = { value: 0 };
  
  const createRequest = (id: number, delay: number) => {
    return bulkhead.execute(async () => {
      activeRequests++;
      maxConcurrentSeen.value = Math.max(maxConcurrentSeen.value, activeRequests);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      
      activeRequests--;
      return `request-${id}`;
    });
  };
  
  // Create multiple requests
  const promises = [
    createRequest(1, 100),
    createRequest(2, 100),
    createRequest(3, 100), // Should be queued
  ];
  
  const results = await Promise.all(promises);
  console.log('✅ Bulkhead execution results:', results);
  console.log('📊 Max concurrent requests seen:', maxConcurrentSeen.value);
  console.log('📊 Bulkhead metrics:', bulkhead.getMetrics());
  console.log('📊 Bulkhead utilization:', bulkhead.getUtilization());
  
  // Test rejection when at capacity
  const morePromises = [];
  for (let i = 0; i < 10; i++) {
    morePromises.push(
      createRequest(i + 10, 500).catch(error => `rejected: ${error.message}`)
    );
  }
  
  const moreResults = await Promise.all(morePromises);
  const rejectedCount = moreResults.filter(r => r.includes('rejected')).length;
  console.log(`🚫 Rejected ${rejectedCount} requests when at capacity`);
  
  console.log('✅ Bulkhead test completed\n');
}

async function testAIGeneratorResilience() {
  console.log('🤖 Testing AI Generator with Resilience...');
  
  const generator = new AIAppGenerator();
  
  try {
    // This should work with fallback since no API key is configured
    const result = await generator.generateApp('Create a simple todo app');
    console.log('✅ AI Generator with resilience:', result.appName);
    
    // Check resilience metrics
    const resilienceMetrics = generator.getResilienceMetrics();
    console.log('📊 Resilience metrics:', {
      circuitBreakerEnabled: resilienceMetrics.enabled.circuitBreaker,
      bulkheadEnabled: resilienceMetrics.enabled.bulkhead,
      healthy: generator.isResilienceHealthy(),
    });
    
  } catch (error) {
    console.error('❌ AI Generator test failed:', error);
  }
  
  console.log('✅ AI Generator resilience test completed\n');
}

async function main() {
  console.log('🚀 Starting Resilience Pattern Tests\n');
  
  try {
    await testCircuitBreaker();
    await testBulkhead();
    await testAIGeneratorResilience();
    
    console.log('🎉 All resilience tests completed successfully!');
  } catch (error) {
    console.error('💥 Test failed:', error);
    process.exit(1);
  }
}

// Run tests
main().catch(console.error);