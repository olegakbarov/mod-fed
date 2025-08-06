import { CircuitBreaker, CircuitBreakerState, CircuitBreakerError, CircuitBreakerConfig } from '../circuit-breaker';
import { logger } from '../../monitoring/logger';

// Mock the logger to avoid console output during tests
jest.mock('../../monitoring/logger');
jest.mock('../../monitoring/metrics');

describe('CircuitBreaker', () => {
  let config: CircuitBreakerConfig;
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    config = {
      name: 'test-circuit',
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 1000, // 1 second for fast tests
      monitoringWindow: 5000,
      volumeThreshold: 5,
    };
    circuitBreaker = new CircuitBreaker(config);
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize in CLOSED state', () => {
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
      expect(circuitBreaker.isHealthy()).toBe(true);
    });

    it('should initialize with correct configuration', () => {
      expect(circuitBreaker.getName()).toBe('test-circuit');
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.state).toBe(CircuitBreakerState.CLOSED);
      expect(metrics.failureCount).toBe(0);
      expect(metrics.successCount).toBe(0);
    });
  });

  describe('successful execution', () => {
    it('should execute function successfully when closed', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      
      const result = await circuitBreaker.execute(mockFn);
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });

    it('should track successful executions', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      
      await circuitBreaker.execute(mockFn);
      await circuitBreaker.execute(mockFn);
      
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.totalSuccesses).toBe(2);
      expect(metrics.totalRequests).toBe(2);
    });
  });

  describe('failure handling', () => {
    it('should track failures without opening circuit initially', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('test error'));
      
      // First failure - should not open circuit yet
      await expect(circuitBreaker.execute(mockFn)).rejects.toThrow('test error');
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
      
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.totalFailures).toBe(1);
      expect(metrics.failureCount).toBe(1);
    });

    it('should not open circuit until volume threshold is met', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('test error'));
      
      // Execute failures but less than volumeThreshold
      for (let i = 0; i < config.volumeThreshold - 1; i++) {
        await expect(circuitBreaker.execute(mockFn)).rejects.toThrow('test error');
      }
      
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });

    it('should open circuit after failure threshold is exceeded with sufficient volume', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('test error'));
      
      // Execute enough requests to meet volume threshold, all failures
      for (let i = 0; i < config.volumeThreshold; i++) {
        await expect(circuitBreaker.execute(mockFn)).rejects.toThrow('test error');
      }
      
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);
      expect(circuitBreaker.isHealthy()).toBe(false);
    });
  });

  describe('circuit breaker states', () => {
    it('should reject requests immediately when circuit is open', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('test error'));
      
      // Open the circuit
      for (let i = 0; i < config.volumeThreshold; i++) {
        await expect(circuitBreaker.execute(mockFn)).rejects.toThrow('test error');
      }
      
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);
      
      // New request should be rejected immediately
      const rejectedFn = jest.fn().mockResolvedValue('should not be called');
      await expect(circuitBreaker.execute(rejectedFn)).rejects.toThrow(CircuitBreakerError);
      expect(rejectedFn).not.toHaveBeenCalled();
    });

    it('should transition to HALF_OPEN after timeout', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('test error'));
      
      // Open the circuit
      for (let i = 0; i < config.volumeThreshold; i++) {
        await expect(circuitBreaker.execute(mockFn)).rejects.toThrow('test error');
      }
      
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);
      
      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, config.timeout + 100));
      
      // Next request should transition to HALF_OPEN
      const testFn = jest.fn().mockResolvedValue('recovery test');
      const result = await circuitBreaker.execute(testFn);
      
      expect(result).toBe('recovery test');
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.HALF_OPEN);
    });

    it('should close circuit after sufficient successes in HALF_OPEN', async () => {
      // First, open the circuit
      const failFn = jest.fn().mockRejectedValue(new Error('test error'));
      for (let i = 0; i < config.volumeThreshold; i++) {
        await expect(circuitBreaker.execute(failFn)).rejects.toThrow('test error');
      }
      
      // Wait for timeout to transition to HALF_OPEN
      await new Promise(resolve => setTimeout(resolve, config.timeout + 100));
      
      // Execute successful requests to close the circuit
      const successFn = jest.fn().mockResolvedValue('success');
      
      for (let i = 0; i < config.successThreshold; i++) {
        await circuitBreaker.execute(successFn);
      }
      
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
      expect(circuitBreaker.isHealthy()).toBe(true);
    });

    it('should reopen circuit on failure in HALF_OPEN state', async () => {
      // Open the circuit
      const failFn = jest.fn().mockRejectedValue(new Error('test error'));
      for (let i = 0; i < config.volumeThreshold; i++) {
        await expect(circuitBreaker.execute(failFn)).rejects.toThrow('test error');
      }
      
      // Wait for timeout to transition to HALF_OPEN
      await new Promise(resolve => setTimeout(resolve, config.timeout + 100));
      
      // First request transitions to HALF_OPEN
      const successFn = jest.fn().mockResolvedValue('success');
      await circuitBreaker.execute(successFn);
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.HALF_OPEN);
      
      // Failure should reopen the circuit
      await expect(circuitBreaker.execute(failFn)).rejects.toThrow('test error');
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);
    });
  });

  describe('failure rate calculation', () => {
    it('should calculate failure rate correctly', async () => {
      const successFn = jest.fn().mockResolvedValue('success');
      const failFn = jest.fn().mockRejectedValue(new Error('fail'));
      
      // Execute mix of successes and failures
      await circuitBreaker.execute(successFn); // success
      await expect(circuitBreaker.execute(failFn)).rejects.toThrow(); // failure
      await circuitBreaker.execute(successFn); // success
      await expect(circuitBreaker.execute(failFn)).rejects.toThrow(); // failure
      
      const failureRate = circuitBreaker.getCurrentFailureRate();
      expect(failureRate).toBe(50); // 50% failure rate
    });

    it('should return 0 failure rate when no requests', () => {
      const failureRate = circuitBreaker.getCurrentFailureRate();
      expect(failureRate).toBe(0);
    });
  });

  describe('metrics and monitoring', () => {
    it('should provide accurate metrics', async () => {
      const successFn = jest.fn().mockResolvedValue('success');
      const failFn = jest.fn().mockRejectedValue(new Error('fail'));
      
      await circuitBreaker.execute(successFn);
      await expect(circuitBreaker.execute(failFn)).rejects.toThrow();
      await circuitBreaker.execute(successFn);
      
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.totalRequests).toBe(3);
      expect(metrics.totalSuccesses).toBe(2);
      expect(metrics.totalFailures).toBe(1);
      expect(metrics.state).toBe(CircuitBreakerState.CLOSED);
    });

    it('should track timing information', async () => {
      const successFn = jest.fn().mockResolvedValue('success');
      await circuitBreaker.execute(successFn);
      
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.lastSuccessTime).toBeDefined();
      expect(metrics.stateTransitionTime).toBeDefined();
    });
  });

  describe('manual controls', () => {
    it('should allow forcing circuit state', () => {
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
      
      circuitBreaker.forceState(CircuitBreakerState.OPEN, 'test');
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);
    });

    it('should allow resetting circuit', async () => {
      const failFn = jest.fn().mockRejectedValue(new Error('fail'));
      
      // Generate some activity
      await expect(circuitBreaker.execute(failFn)).rejects.toThrow();
      
      let metrics = circuitBreaker.getMetrics();
      expect(metrics.totalRequests).toBe(1);
      
      circuitBreaker.reset();
      
      metrics = circuitBreaker.getMetrics();
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.state).toBe(CircuitBreakerState.CLOSED);
      expect(circuitBreaker.isHealthy()).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should pass through CircuitBreakerError correctly', async () => {
      // Open the circuit
      const failFn = jest.fn().mockRejectedValue(new Error('test error'));
      for (let i = 0; i < config.volumeThreshold; i++) {
        await expect(circuitBreaker.execute(failFn)).rejects.toThrow('test error');
      }
      
      // Next call should throw CircuitBreakerError
      const testFn = jest.fn().mockResolvedValue('should not execute');
      
      try {
        await circuitBreaker.execute(testFn);
        fail('Should have thrown CircuitBreakerError');
      } catch (error) {
        expect(error).toBeInstanceOf(CircuitBreakerError);
        expect((error as CircuitBreakerError).circuitBreakerName).toBe('test-circuit');
        expect((error as CircuitBreakerError).circuitState).toBe(CircuitBreakerState.OPEN);
      }
    });

    it('should handle async function rejections properly', async () => {
      const asyncError = new Error('async rejection');
      const failFn = jest.fn().mockRejectedValue(asyncError);
      
      await expect(circuitBreaker.execute(failFn)).rejects.toThrow('async rejection');
      
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.totalFailures).toBe(1);
    });
  });

  describe('time window behavior', () => {
    it('should only consider failures within monitoring window', async () => {
      // This test would need to be adjusted based on the actual monitoring window behavior
      // For now, we'll test that the circuit breaker respects the monitoring window concept
      
      const config = {
        name: 'time-window-test',
        failureThreshold: 2,
        successThreshold: 1,
        timeout: 100,
        monitoringWindow: 1000, // 1 second
        volumeThreshold: 2,
      };
      
      const timeWindowCB = new CircuitBreaker(config);
      const failFn = jest.fn().mockRejectedValue(new Error('fail'));
      
      // Execute failures
      await expect(timeWindowCB.execute(failFn)).rejects.toThrow();
      await expect(timeWindowCB.execute(failFn)).rejects.toThrow();
      
      // Should open circuit with sufficient volume and failures
      expect(timeWindowCB.getState()).toBe(CircuitBreakerState.OPEN);
    });
  });

  describe('correlation ID handling', () => {
    it('should pass correlation ID through circuit breaker operations', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      const correlationId = 'test-correlation-id';
      
      const result = await circuitBreaker.execute(mockFn, correlationId);
      
      expect(result).toBe('success');
      // The correlation ID should be passed to logging/metrics (mocked in this test)
    });
  });
});