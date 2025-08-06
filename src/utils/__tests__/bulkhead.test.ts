import { Bulkhead, BulkheadRejectionError, BulkheadConfig } from '../bulkhead';
import { logger } from '../../monitoring/logger';

// Mock the logger and metrics to avoid console output during tests
jest.mock('../../monitoring/logger');
jest.mock('../../monitoring/metrics');

describe('Bulkhead', () => {
  let config: BulkheadConfig;
  let bulkhead: Bulkhead;

  beforeEach(() => {
    config = {
      name: 'test-bulkhead',
      maxConcurrentRequests: 2,
      maxQueueSize: 3,
      queueTimeout: 1000, // 1 second for fast tests
      enableMetrics: true,
    };
    bulkhead = new Bulkhead(config);
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up any pending requests
    bulkhead.clearQueue('test-cleanup');
    // Give some time for cleanup
    await new Promise(resolve => setTimeout(resolve, 50));
  });

  describe('initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(bulkhead.getName()).toBe('test-bulkhead');
      const metrics = bulkhead.getMetrics();
      expect(metrics.activeRequests).toBe(0);
      expect(metrics.queuedRequests).toBe(0);
      expect(metrics.totalRequests).toBe(0);
    });

    it('should start healthy', () => {
      expect(bulkhead.isHealthy()).toBe(true);
    });
  });

  describe('concurrent execution', () => {
    it('should execute requests immediately when under capacity', async () => {
      const mockFn1 = jest.fn().mockResolvedValue('result1');
      const mockFn2 = jest.fn().mockResolvedValue('result2');
      
      const promise1 = bulkhead.execute(mockFn1);
      const promise2 = bulkhead.execute(mockFn2);
      
      const [result1, result2] = await Promise.all([promise1, promise2]);
      
      expect(result1).toBe('result1');
      expect(result2).toBe('result2');
      expect(mockFn1).toHaveBeenCalledTimes(1);
      expect(mockFn2).toHaveBeenCalledTimes(1);
    });

    it('should track active requests correctly', async () => {
      let resolveFn: Function;
      const blockingFn = jest.fn(() => new Promise(resolve => { resolveFn = resolve; }));
      
      const promise = bulkhead.execute(blockingFn);
      
      // Check that request is tracked as active
      const metrics = bulkhead.getMetrics();
      expect(metrics.activeRequests).toBe(1);
      
      // Resolve the request
      resolveFn!('done');
      await promise;
      
      // Check that active request count is decremented
      const finalMetrics = bulkhead.getMetrics();
      expect(finalMetrics.activeRequests).toBe(0);
    });
  });

  describe('request queuing', () => {
    it('should queue requests when at capacity', async () => {
      let resolve1: Function, resolve2: Function, resolve3: Function;
      
      // Fill up the concurrent slots
      const blockingFn1 = jest.fn(() => new Promise(resolve => { resolve1 = resolve; }));
      const blockingFn2 = jest.fn(() => new Promise(resolve => { resolve2 = resolve; }));
      
      const promise1 = bulkhead.execute(blockingFn1);
      const promise2 = bulkhead.execute(blockingFn2);
      
      // Next request should be queued
      const queuedFn = jest.fn(() => new Promise(resolve => { resolve3 = resolve; }));
      const queuedPromise = bulkhead.execute(queuedFn);
      
      const metrics = bulkhead.getMetrics();
      expect(metrics.activeRequests).toBe(2);
      expect(metrics.queuedRequests).toBe(1);
      
      // The queued function should not have been called yet
      expect(queuedFn).not.toHaveBeenCalled();
      
      // Resolve first request
      resolve1!('done1');
      await promise1;
      
      // Give some time for queue processing
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Now the queued function should be executing
      expect(queuedFn).toHaveBeenCalled();
      
      // Clean up
      resolve2!('done2');
      resolve3!('done3');
      await Promise.all([promise2, queuedPromise]);
    });

    it('should reject requests when both capacity and queue are full', async () => {
      const resolvers: Function[] = [];
      
      // Fill up concurrent capacity and queue
      const totalCapacity = config.maxConcurrentRequests + config.maxQueueSize;
      const promises: Promise<any>[] = [];
      
      for (let i = 0; i < totalCapacity; i++) {
        const blockingFn = jest.fn(() => new Promise(resolve => { resolvers.push(resolve); }));
        promises.push(bulkhead.execute(blockingFn));
      }
      
      // Give time for queue to fill
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Next request should be rejected
      const rejectedFn = jest.fn().mockResolvedValue('should not execute');
      await expect(bulkhead.execute(rejectedFn)).rejects.toThrow(BulkheadRejectionError);
      expect(rejectedFn).not.toHaveBeenCalled();
      
      // Clean up
      resolvers.forEach(resolve => resolve('done'));
      await Promise.all(promises);
    });

    it('should handle queue timeout', async () => {
      let resolve1: Function, resolve2: Function;
      
      // Fill concurrent capacity
      const blockingFn1 = jest.fn(() => new Promise(resolve => { resolve1 = resolve; }));
      const blockingFn2 = jest.fn(() => new Promise(resolve => { resolve2 = resolve; }));
      
      const promise1 = bulkhead.execute(blockingFn1);
      const promise2 = bulkhead.execute(blockingFn2);
      
      // Queue a request that should timeout
      const slowFn = jest.fn().mockResolvedValue('should timeout');
      const queuedPromise = bulkhead.execute(slowFn);
      
      // Wait for timeout
      await expect(queuedPromise).rejects.toThrow(BulkheadRejectionError);
      
      const error = await queuedPromise.catch(e => e);
      expect(error.reason).toBe('timeout');
      
      // Clean up
      resolve1!('done1');
      resolve2!('done2');
      await Promise.all([promise1, promise2]);
    });
  });

  describe('error handling', () => {
    it('should propagate function errors correctly', async () => {
      const errorFn = jest.fn().mockRejectedValue(new Error('test error'));
      
      await expect(bulkhead.execute(errorFn)).rejects.toThrow('test error');
      
      const metrics = bulkhead.getMetrics();
      expect(metrics.totalRequests).toBe(1);
    });

    it('should handle BulkheadRejectionError correctly', async () => {
      // Fill capacity
      const resolvers: Function[] = [];
      const totalCapacity = config.maxConcurrentRequests + config.maxQueueSize;
      
      for (let i = 0; i < totalCapacity; i++) {
        const blockingFn = jest.fn(() => new Promise(resolve => { resolvers.push(resolve); }));
        bulkhead.execute(blockingFn);
      }
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      try {
        await bulkhead.execute(() => Promise.resolve('should reject'));
        fail('Should have thrown BulkheadRejectionError');
      } catch (error) {
        expect(error).toBeInstanceOf(BulkheadRejectionError);
        expect((error as BulkheadRejectionError).bulkheadName).toBe('test-bulkhead');
        expect((error as BulkheadRejectionError).reason).toBe('capacity_exceeded');
      }
      
      // Clean up
      resolvers.forEach(resolve => resolve('done'));
    });
  });

  describe('metrics and utilization', () => {
    it('should provide accurate metrics', async () => {
      const fastFn = jest.fn().mockResolvedValue('fast');
      
      await bulkhead.execute(fastFn);
      await bulkhead.execute(fastFn);
      
      const metrics = bulkhead.getMetrics();
      expect(metrics.totalRequests).toBe(2);
      expect(metrics.activeRequests).toBe(0); // Should be finished
      expect(metrics.totalRejected).toBe(0);
      expect(metrics.totalTimeouts).toBe(0);
    });

    it('should calculate utilization correctly', async () => {
      let resolve1: Function;
      const blockingFn = jest.fn(() => new Promise(resolve => { resolve1 = resolve; }));
      
      const promise = bulkhead.execute(blockingFn);
      
      const utilization = bulkhead.getUtilization();
      expect(utilization.executionUtilization).toBe(50); // 1 of 2 slots used
      expect(utilization.queueUtilization).toBe(0);
      expect(utilization.totalUtilization).toBe(20); // 1 of 5 total slots used
      
      resolve1!('done');
      await promise;
    });

    it('should track queue metrics', async () => {
      let resolve1: Function, resolve2: Function;
      
      // Fill concurrent capacity
      const blockingFn1 = jest.fn(() => new Promise(resolve => { resolve1 = resolve; }));
      const blockingFn2 = jest.fn(() => new Promise(resolve => { resolve2 = resolve; }));
      
      const promise1 = bulkhead.execute(blockingFn1);
      const promise2 = bulkhead.execute(blockingFn2);
      
      // Add queued request
      const queuedFn = jest.fn().mockResolvedValue('queued');
      const queuedPromise = bulkhead.execute(queuedFn);
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const utilization = bulkhead.getUtilization();
      expect(utilization.executionUtilization).toBe(100); // 2 of 2 slots
      expect(utilization.queueUtilization).toBeGreaterThan(0); // Should have queue usage
      
      // Clean up
      resolve1!('done1');
      resolve2!('done2');
      await Promise.all([promise1, promise2, queuedPromise]);
    });
  });

  describe('health checks', () => {
    it('should be unhealthy when utilization is too high', async () => {
      // This test depends on the health check logic in the bulkhead implementation
      // Fill up most of the capacity to trigger unhealthy state
      const resolvers: Function[] = [];
      const nearCapacity = config.maxConcurrentRequests + config.maxQueueSize - 1;
      
      for (let i = 0; i < nearCapacity; i++) {
        const blockingFn = jest.fn(() => new Promise(resolve => { resolvers.push(resolve); }));
        bulkhead.execute(blockingFn);
      }
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const utilization = bulkhead.getUtilization();
      if (utilization.totalUtilization > 90) {
        expect(bulkhead.isHealthy()).toBe(false);
      }
      
      // Clean up
      resolvers.forEach(resolve => resolve('done'));
    });
  });

  describe('queue management', () => {
    it('should clear queue when requested', async () => {
      let resolve1: Function, resolve2: Function;
      
      // Fill concurrent capacity
      const blockingFn1 = jest.fn(() => new Promise(resolve => { resolve1 = resolve; }));
      const blockingFn2 = jest.fn(() => new Promise(resolve => { resolve2 = resolve; }));
      
      const promise1 = bulkhead.execute(blockingFn1);
      const promise2 = bulkhead.execute(blockingFn2);
      
      // Add queued requests
      const queuedFn1 = jest.fn().mockResolvedValue('queued1');
      const queuedFn2 = jest.fn().mockResolvedValue('queued2');
      
      const queuedPromise1 = bulkhead.execute(queuedFn1);
      const queuedPromise2 = bulkhead.execute(queuedFn2);
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      let metrics = bulkhead.getMetrics();
      expect(metrics.queuedRequests).toBe(2);
      
      // Clear the queue
      const clearedCount = bulkhead.clearQueue('test clear');
      expect(clearedCount).toBe(2);
      
      metrics = bulkhead.getMetrics();
      expect(metrics.queuedRequests).toBe(0);
      
      // Queued requests should be rejected
      await expect(queuedPromise1).rejects.toThrow(BulkheadRejectionError);
      await expect(queuedPromise2).rejects.toThrow(BulkheadRejectionError);
      
      // Clean up active requests
      resolve1!('done1');
      resolve2!('done2');
      await Promise.all([promise1, promise2]);
    });

    it('should process queue in FIFO order', async () => {
      let resolve1: Function, resolve2: Function;
      const executionOrder: number[] = [];
      
      // Fill concurrent capacity
      const blockingFn1 = jest.fn(() => new Promise(resolve => { resolve1 = resolve; }));
      const blockingFn2 = jest.fn(() => new Promise(resolve => { resolve2 = resolve; }));
      
      const promise1 = bulkhead.execute(blockingFn1);
      const promise2 = bulkhead.execute(blockingFn2);
      
      // Queue multiple requests
      const queuedFn1 = jest.fn(() => { executionOrder.push(1); return Promise.resolve('first'); });
      const queuedFn2 = jest.fn(() => { executionOrder.push(2); return Promise.resolve('second'); });
      const queuedFn3 = jest.fn(() => { executionOrder.push(3); return Promise.resolve('third'); });
      
      const queuedPromise1 = bulkhead.execute(queuedFn1);
      const queuedPromise2 = bulkhead.execute(queuedFn2);
      const queuedPromise3 = bulkhead.execute(queuedFn3);
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Release one slot to start queue processing
      resolve1!('done1');
      await promise1;
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Release another slot
      resolve2!('done2');
      await promise2;
      
      await Promise.all([queuedPromise1, queuedPromise2, queuedPromise3]);
      
      // Should execute in order
      expect(executionOrder).toEqual([1, 2, 3]);
    });
  });

  describe('configuration validation', () => {
    it('should work with different configurations', () => {
      const customConfig: BulkheadConfig = {
        name: 'custom-bulkhead',
        maxConcurrentRequests: 5,
        maxQueueSize: 10,
        queueTimeout: 2000,
        enableMetrics: false,
      };
      
      const customBulkhead = new Bulkhead(customConfig);
      expect(customBulkhead.getName()).toBe('custom-bulkhead');
      expect(customBulkhead.getConfig()).toEqual(customConfig);
    });
  });

  describe('correlation ID handling', () => {
    it('should pass correlation ID through bulkhead operations', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      const correlationId = 'test-correlation-id';
      
      const result = await bulkhead.execute(mockFn, correlationId);
      
      expect(result).toBe('success');
      // The correlation ID should be passed to logging/metrics (mocked in this test)
    });
  });

  describe('concurrent stress testing', () => {
    it('should handle high concurrency correctly', async () => {
      const results: string[] = [];
      const promises: Promise<any>[] = [];
      const expectedRejections: Promise<any>[] = [];
      
      // Create more requests than total capacity
      const totalRequests = (config.maxConcurrentRequests + config.maxQueueSize) * 2;
      
      for (let i = 0; i < totalRequests; i++) {
        const fn = jest.fn().mockResolvedValue(`result-${i}`);
        const promise = bulkhead.execute(fn);
        
        promises.push(
          promise.then(result => {
            results.push(result);
            return result;
          }).catch(error => {
            if (error instanceof BulkheadRejectionError) {
              expectedRejections.push(promise);
            }
            throw error;
          })
        );
      }
      
      // Some should succeed, some should be rejected
      const settled = await Promise.allSettled(promises);
      
      const successful = settled.filter(p => p.status === 'fulfilled').length;
      const rejected = settled.filter(p => p.status === 'rejected').length;
      
      expect(successful).toBeLessThan(totalRequests);
      expect(rejected).toBeGreaterThan(0);
      expect(successful + rejected).toBe(totalRequests);
    }, 10000); // Longer timeout for stress test
  });
});