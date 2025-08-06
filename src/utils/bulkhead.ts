import { logger } from '../monitoring/logger';
import { metricsCollector } from '../monitoring/metrics';
import { AIAppGeneratorError } from '../errors/ai-errors';

export interface BulkheadConfig {
  name: string;
  maxConcurrentRequests: number; // Maximum concurrent requests allowed
  maxQueueSize: number; // Maximum number of queued requests
  queueTimeout: number; // Time in ms before queued request times out
  enableMetrics: boolean; // Whether to collect detailed metrics
}

export interface BulkheadMetrics {
  activeRequests: number;
  queuedRequests: number;
  totalRequests: number;
  totalRejected: number;
  totalTimeouts: number;
  averageWaitTime: number;
  averageExecutionTime: number;
  maxActiveRequests: number;
  maxQueueSize: number;
}

interface QueuedRequest<T> {
  id: string;
  correlationId?: string;
  executor: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  queuedAt: number;
  timeoutId?: NodeJS.Timeout;
}

export class BulkheadRejectionError extends AIAppGeneratorError {
  public readonly bulkheadName: string;
  public readonly reason: 'capacity_exceeded' | 'queue_full' | 'timeout';
  public readonly activeRequests: number;
  public readonly queuedRequests: number;

  constructor(
    message: string,
    bulkheadName: string,
    reason: 'capacity_exceeded' | 'queue_full' | 'timeout',
    activeRequests: number,
    queuedRequests: number,
    correlationId?: string
  ) {
    super(
      message,
      'BULKHEAD_REJECTION_ERROR',
      429, // Too Many Requests
      true, // Retryable after some time
      correlationId,
      {
        bulkheadName,
        reason,
        activeRequests,
        queuedRequests,
      }
    );

    this.bulkheadName = bulkheadName;
    this.reason = reason;
    this.activeRequests = activeRequests;
    this.queuedRequests = queuedRequests;
  }
}

export class Bulkhead {
  private activeRequests: Map<string, { startTime: number; correlationId?: string }> = new Map();
  private requestQueue: Array<QueuedRequest<any>> = [];
  private totalRequests: number = 0;
  private totalRejected: number = 0;
  private totalTimeouts: number = 0;
  private totalExecutionTime: number = 0;
  private totalWaitTime: number = 0;
  private maxActiveRequestsReached: number = 0;
  private maxQueueSizeReached: number = 0;

  constructor(private config: BulkheadConfig) {
    logger.info('Bulkhead initialized', {
      bulkhead: {
        name: config.name,
        maxConcurrentRequests: config.maxConcurrentRequests,
        maxQueueSize: config.maxQueueSize,
        queueTimeout: config.queueTimeout,
        enableMetrics: config.enableMetrics,
      },
    });

    // Start periodic metrics collection
    if (config.enableMetrics) {
      this.startMetricsCollection();
    }
  }

  /**
   * Execute a function with bulkhead protection
   */
  async execute<T>(
    executor: () => Promise<T>,
    correlationId?: string
  ): Promise<T> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();
    
    this.totalRequests++;

    logger.debug(`Bulkhead '${this.config.name}' received request`, {
      bulkhead: {
        name: this.config.name,
        requestId,
        activeRequests: this.activeRequests.size,
        queuedRequests: this.requestQueue.length,
      },
    }, correlationId);

    try {
      // Check if we can execute immediately
      if (this.activeRequests.size < this.config.maxConcurrentRequests) {
        return await this.executeImmediately(requestId, executor, correlationId, startTime);
      }

      // Check if we can queue the request
      if (this.requestQueue.length < this.config.maxQueueSize) {
        return await this.queueRequest(requestId, executor, correlationId, startTime);
      }

      // Reject request due to full capacity
      this.totalRejected++;
      const error = new BulkheadRejectionError(
        `Bulkhead '${this.config.name}' is at full capacity. Both active execution slots and queue are full.`,
        this.config.name,
        'capacity_exceeded',
        this.activeRequests.size,
        this.requestQueue.length,
        correlationId
      );

      this.recordMetrics('rejected', correlationId, Date.now() - startTime);
      throw error;
    } catch (error) {
      // Ensure proper cleanup and metric recording
      if (error instanceof BulkheadRejectionError) {
        throw error;
      }
      
      // Wrap unexpected errors
      const wrappedError = new AIAppGeneratorError(
        `Bulkhead '${this.config.name}' execution failed: ${(error as Error).message}`,
        'BULKHEAD_EXECUTION_ERROR',
        500,
        true,
        correlationId,
        {
          bulkheadName: this.config.name,
          requestId,
          originalError: {
            name: (error as Error).name,
            message: (error as Error).message,
          },
        }
      );
      
      this.recordMetrics('error', correlationId, Date.now() - startTime, error as Error);
      throw wrappedError;
    }
  }

  /**
   * Execute request immediately without queuing
   */
  private async executeImmediately<T>(
    requestId: string,
    executor: () => Promise<T>,
    correlationId?: string,
    startTime: number = Date.now()
  ): Promise<T> {
    // Reserve execution slot
    this.activeRequests.set(requestId, { 
      startTime: Date.now(), 
      correlationId 
    });
    
    // Update metrics
    this.maxActiveRequestsReached = Math.max(
      this.maxActiveRequestsReached,
      this.activeRequests.size
    );

    logger.debug(`Bulkhead '${this.config.name}' executing request immediately`, {
      bulkhead: {
        name: this.config.name,
        requestId,
        activeRequests: this.activeRequests.size,
      },
    }, correlationId);

    try {
      const executionStartTime = Date.now();
      const result = await executor();
      const executionTime = Date.now() - executionStartTime;
      
      // Update execution time metrics
      this.totalExecutionTime += executionTime;
      
      this.recordMetrics('success', correlationId, Date.now() - startTime, undefined, executionTime);
      
      logger.debug(`Bulkhead '${this.config.name}' completed request`, {
        bulkhead: {
          name: this.config.name,
          requestId,
          executionTime,
          totalTime: Date.now() - startTime,
        },
      }, correlationId);
      
      return result;
    } finally {
      // Release execution slot
      this.activeRequests.delete(requestId);
      
      // Process next request from queue
      this.processNextFromQueue();
    }
  }

  /**
   * Queue request for later execution
   */
  private async queueRequest<T>(
    requestId: string,
    executor: () => Promise<T>,
    correlationId?: string,
    startTime: number = Date.now()
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const queuedAt = Date.now();
      
      // Setup timeout for queued request
      const timeoutId = setTimeout(() => {
        this.handleQueueTimeout(requestId, correlationId);
        reject(new BulkheadRejectionError(
          `Bulkhead '${this.config.name}' request timed out in queue after ${this.config.queueTimeout}ms`,
          this.config.name,
          'timeout',
          this.activeRequests.size,
          this.requestQueue.length,
          correlationId
        ));
      }, this.config.queueTimeout);

      const queuedRequest: QueuedRequest<T> = {
        id: requestId,
        correlationId,
        executor,
        resolve,
        reject,
        queuedAt,
        timeoutId,
      };

      this.requestQueue.push(queuedRequest);
      
      // Update metrics
      this.maxQueueSizeReached = Math.max(
        this.maxQueueSizeReached,
        this.requestQueue.length
      );

      logger.debug(`Bulkhead '${this.config.name}' queued request`, {
        bulkhead: {
          name: this.config.name,
          requestId,
          queuePosition: this.requestQueue.length,
          activeRequests: this.activeRequests.size,
          estimatedWaitTime: this.estimateWaitTime(),
        },
      }, correlationId);

      this.recordMetrics('queued', correlationId, Date.now() - startTime);
    });
  }

  /**
   * Process next request from queue
   */
  private processNextFromQueue(): void {
    if (this.requestQueue.length === 0 || 
        this.activeRequests.size >= this.config.maxConcurrentRequests) {
      return;
    }

    const nextRequest = this.requestQueue.shift();
    if (!nextRequest) {
      return;
    }

    // Clear timeout since we're processing the request
    if (nextRequest.timeoutId) {
      clearTimeout(nextRequest.timeoutId);
    }

    const waitTime = Date.now() - nextRequest.queuedAt;
    this.totalWaitTime += waitTime;

    logger.debug(`Bulkhead '${this.config.name}' processing request from queue`, {
      bulkhead: {
        name: this.config.name,
        requestId: nextRequest.id,
        waitTime,
        remainingInQueue: this.requestQueue.length,
      },
    }, nextRequest.correlationId);

    // Execute the request
    this.executeImmediately(
      nextRequest.id,
      nextRequest.executor,
      nextRequest.correlationId,
      nextRequest.queuedAt
    )
      .then(result => {
        nextRequest.resolve(result);
        this.recordMetrics('dequeued_success', nextRequest.correlationId, waitTime);
      })
      .catch(error => {
        nextRequest.reject(error);
        this.recordMetrics('dequeued_error', nextRequest.correlationId, waitTime, error);
      });
  }

  /**
   * Handle queue timeout
   */
  private handleQueueTimeout(requestId: string, correlationId?: string): void {
    // Remove from queue
    this.requestQueue = this.requestQueue.filter(req => req.id !== requestId);
    this.totalTimeouts++;

    logger.warn(`Bulkhead '${this.config.name}' request timed out in queue`, {
      bulkhead: {
        name: this.config.name,
        requestId,
        queueTimeout: this.config.queueTimeout,
        remainingInQueue: this.requestQueue.length,
      },
    }, correlationId);

    this.recordMetrics('timeout', correlationId, this.config.queueTimeout);
  }

  /**
   * Estimate wait time for new requests
   */
  private estimateWaitTime(): number {
    if (this.activeRequests.size < this.config.maxConcurrentRequests) {
      return 0;
    }

    // Simple estimation based on average execution time and queue position
    const avgExecutionTime = this.totalRequests > 0 ? 
      this.totalExecutionTime / this.totalRequests : 1000;
    
    const queuePosition = this.requestQueue.length + 1;
    const availableSlots = this.config.maxConcurrentRequests;
    
    return Math.ceil((queuePosition / availableSlots) * avgExecutionTime);
  }

  /**
   * Record metrics for monitoring
   */
  private recordMetrics(
    outcome: 'success' | 'error' | 'rejected' | 'queued' | 'timeout' | 'dequeued_success' | 'dequeued_error',
    correlationId?: string,
    duration?: number,
    error?: Error,
    executionTime?: number
  ): void {
    if (!this.config.enableMetrics) {
      return;
    }

    metricsCollector.recordMetric({
      name: 'bulkhead_requests',
      value: 1,
      timestamp: Date.now(),
      labels: {
        name: this.config.name,
        outcome,
      },
      correlationId,
    });

    if (duration !== undefined) {
      metricsCollector.recordMetric({
        name: 'bulkhead_request_duration',
        value: duration,
        timestamp: Date.now(),
        labels: {
          name: this.config.name,
          outcome,
          type: 'total',
        },
        correlationId,
      });
    }

    if (executionTime !== undefined) {
      metricsCollector.recordMetric({
        name: 'bulkhead_execution_duration',
        value: executionTime,
        timestamp: Date.now(),
        labels: {
          name: this.config.name,
          outcome,
        },
        correlationId,
      });
    }

    // Record current bulkhead utilization
    metricsCollector.recordMetric({
      name: 'bulkhead_active_requests',
      value: this.activeRequests.size,
      timestamp: Date.now(),
      labels: {
        name: this.config.name,
      },
      correlationId,
    });

    metricsCollector.recordMetric({
      name: 'bulkhead_queued_requests',
      value: this.requestQueue.length,
      timestamp: Date.now(),
      labels: {
        name: this.config.name,
      },
      correlationId,
    });
  }

  /**
   * Get current bulkhead metrics
   */
  getMetrics(): BulkheadMetrics {
    return {
      activeRequests: this.activeRequests.size,
      queuedRequests: this.requestQueue.length,
      totalRequests: this.totalRequests,
      totalRejected: this.totalRejected,
      totalTimeouts: this.totalTimeouts,
      averageWaitTime: this.totalRequests > 0 ? this.totalWaitTime / this.totalRequests : 0,
      averageExecutionTime: this.totalRequests > 0 ? this.totalExecutionTime / this.totalRequests : 0,
      maxActiveRequests: this.maxActiveRequestsReached,
      maxQueueSize: this.maxQueueSizeReached,
    };
  }

  /**
   * Get current utilization percentage
   */
  getUtilization(): {
    executionUtilization: number; // Percentage of execution slots used
    queueUtilization: number; // Percentage of queue slots used
    totalUtilization: number; // Combined utilization
  } {
    const executionUtilization = (this.activeRequests.size / this.config.maxConcurrentRequests) * 100;
    const queueUtilization = (this.requestQueue.length / this.config.maxQueueSize) * 100;
    const totalCapacity = this.config.maxConcurrentRequests + this.config.maxQueueSize;
    const totalUsed = this.activeRequests.size + this.requestQueue.length;
    const totalUtilization = (totalUsed / totalCapacity) * 100;

    return {
      executionUtilization,
      queueUtilization,
      totalUtilization,
    };
  }

  /**
   * Check if bulkhead is healthy
   */
  isHealthy(): boolean {
    const utilization = this.getUtilization();
    
    // Consider unhealthy if total utilization is above 90%
    if (utilization.totalUtilization > 90) {
      return false;
    }

    // Consider unhealthy if too many timeouts recently
    const recentTimeoutRate = this.totalRequests > 0 ? 
      (this.totalTimeouts / this.totalRequests) * 100 : 0;
    
    if (recentTimeoutRate > 10) { // More than 10% timeout rate
      return false;
    }

    return true;
  }

  /**
   * Get queue position for a specific request (for debugging)
   */
  getQueuePosition(requestId: string): number {
    const position = this.requestQueue.findIndex(req => req.id === requestId);
    return position === -1 ? -1 : position + 1; // 1-based indexing
  }

  /**
   * Start periodic metrics collection
   */
  private startMetricsCollection(): void {
    setInterval(() => {
      this.recordMetrics('success'); // Periodic metric recording
    }, 30000); // Every 30 seconds
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `${this.config.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clear all queued requests (for emergency situations)
   */
  clearQueue(reason: string = 'manual'): number {
    const clearedCount = this.requestQueue.length;
    
    // Reject all queued requests
    this.requestQueue.forEach(req => {
      if (req.timeoutId) {
        clearTimeout(req.timeoutId);
      }
      
      req.reject(new BulkheadRejectionError(
        `Bulkhead '${this.config.name}' queue cleared: ${reason}`,
        this.config.name,
        'capacity_exceeded',
        this.activeRequests.size,
        this.requestQueue.length,
        req.correlationId
      ));
    });

    this.requestQueue = [];
    this.totalRejected += clearedCount;

    logger.warn(`Bulkhead '${this.config.name}' queue cleared`, {
      bulkhead: {
        name: this.config.name,
        clearedCount,
        reason,
        remainingActiveRequests: this.activeRequests.size,
      },
    });

    return clearedCount;
  }

  /**
   * Get bulkhead name
   */
  getName(): string {
    return this.config.name;
  }

  /**
   * Get current configuration
   */
  getConfig(): BulkheadConfig {
    return { ...this.config };
  }
}