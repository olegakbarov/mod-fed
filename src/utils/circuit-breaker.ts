import { logger } from '../monitoring/logger';
import { metricsCollector } from '../monitoring/metrics';
import { AIAppGeneratorError } from '../errors/ai-errors';

export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerConfig {
  name: string;
  failureThreshold: number; // Number of failures to open the circuit
  successThreshold: number; // Number of successes to close from half-open
  timeout: number; // Time in ms to wait before attempting recovery (half-open)
  monitoringWindow: number; // Time window in ms for failure counting
  volumeThreshold: number; // Minimum number of requests in window before evaluating
}

export interface CircuitBreakerMetrics {
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  requestCount: number;
  lastFailureTime?: number;
  lastSuccessTime?: number;
  stateTransitionTime: number;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
}

export class CircuitBreakerError extends AIAppGeneratorError {
  public readonly circuitBreakerName: string;
  public readonly circuitState: CircuitBreakerState;

  constructor(
    message: string,
    circuitBreakerName: string,
    circuitState: CircuitBreakerState,
    correlationId?: string
  ) {
    super(
      message,
      'CIRCUIT_BREAKER_ERROR',
      503, // Service Unavailable
      false, // Not retryable when circuit is open
      correlationId,
      {
        circuitBreakerName,
        circuitState,
      }
    );

    this.circuitBreakerName = circuitBreakerName;
    this.circuitState = circuitState;
  }
}

export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private requestCount: number = 0;
  private lastFailureTime?: number;
  private lastSuccessTime?: number;
  private stateTransitionTime: number = Date.now();
  private totalRequests: number = 0;
  private totalFailures: number = 0;
  private totalSuccesses: number = 0;

  // Window tracking for rolling failure counting
  private requestHistory: Array<{ timestamp: number; success: boolean }> = [];

  constructor(private config: CircuitBreakerConfig) {
    logger.info('Circuit breaker initialized', {
      circuitBreaker: {
        name: config.name,
        failureThreshold: config.failureThreshold,
        successThreshold: config.successThreshold,
        timeout: config.timeout,
        monitoringWindow: config.monitoringWindow,
        volumeThreshold: config.volumeThreshold,
      },
    });
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(
    fn: () => Promise<T>,
    correlationId?: string
  ): Promise<T> {
    // Check if circuit should allow the request
    if (!this.canExecute()) {
      const error = new CircuitBreakerError(
        `Circuit breaker '${this.config.name}' is ${this.state}. Request rejected.`,
        this.config.name,
        this.state,
        correlationId
      );
      
      this.recordMetrics('rejected', correlationId);
      throw error;
    }

    const startTime = Date.now();
    this.totalRequests++;
    this.requestCount++;

    try {
      const result = await fn();
      this.onSuccess(correlationId);
      
      this.recordMetrics('success', correlationId, Date.now() - startTime);
      return result;
    } catch (error) {
      this.onFailure(error as Error, correlationId);
      
      this.recordMetrics('failure', correlationId, Date.now() - startTime, error as Error);
      throw error;
    }
  }

  /**
   * Check if the circuit breaker allows execution
   */
  private canExecute(): boolean {
    const now = Date.now();

    switch (this.state) {
      case CircuitBreakerState.CLOSED:
        return true;

      case CircuitBreakerState.OPEN:
        // Check if timeout has passed to transition to HALF_OPEN
        if (now - this.stateTransitionTime >= this.config.timeout) {
          this.transitionTo(CircuitBreakerState.HALF_OPEN);
          return true;
        }
        return false;

      case CircuitBreakerState.HALF_OPEN:
        // Allow limited requests in half-open state
        return true;

      default:
        return false;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(correlationId?: string): void {
    this.lastSuccessTime = Date.now();
    this.totalSuccesses++;
    this.successCount++;

    // Add to request history for rolling window
    this.addToHistory(true);
    this.cleanupHistory();

    logger.debug(`Circuit breaker '${this.config.name}' recorded success`, {
      circuitBreaker: {
        name: this.config.name,
        state: this.state,
        successCount: this.successCount,
        failureCount: this.failureCount,
      },
    }, correlationId);

    switch (this.state) {
      case CircuitBreakerState.HALF_OPEN:
        // Check if we should close the circuit
        if (this.successCount >= this.config.successThreshold) {
          this.transitionTo(CircuitBreakerState.CLOSED);
        }
        break;

      case CircuitBreakerState.CLOSED:
        // Reset failure count on success
        this.failureCount = 0;
        break;
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(error: Error, correlationId?: string): void {
    this.lastFailureTime = Date.now();
    this.totalFailures++;
    this.failureCount++;

    // Add to request history for rolling window
    this.addToHistory(false);
    this.cleanupHistory();

    logger.warn(`Circuit breaker '${this.config.name}' recorded failure`, error, {
      circuitBreaker: {
        name: this.config.name,
        state: this.state,
        successCount: this.successCount,
        failureCount: this.failureCount,
        error: {
          name: error.name,
          message: error.message,
        },
      },
    }, correlationId);

    switch (this.state) {
      case CircuitBreakerState.CLOSED:
        // Check if we should open the circuit
        if (this.shouldOpenCircuit()) {
          this.transitionTo(CircuitBreakerState.OPEN);
        }
        break;

      case CircuitBreakerState.HALF_OPEN:
        // Any failure in half-open state should reopen the circuit
        this.transitionTo(CircuitBreakerState.OPEN);
        break;
    }
  }

  /**
   * Determine if circuit should open based on failure rate
   */
  private shouldOpenCircuit(): boolean {
    // Get failures in the current monitoring window
    const now = Date.now();
    const windowStart = now - this.config.monitoringWindow;
    const recentRequests = this.requestHistory.filter(
      req => req.timestamp >= windowStart
    );

    // Check volume threshold
    if (recentRequests.length < this.config.volumeThreshold) {
      return false;
    }

    // Check failure threshold
    const recentFailures = recentRequests.filter(req => !req.success);
    return recentFailures.length >= this.config.failureThreshold;
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: CircuitBreakerState): void {
    const oldState = this.state;
    this.state = newState;
    this.stateTransitionTime = Date.now();

    // Reset counters on state transition
    this.successCount = 0;
    this.failureCount = 0;
    this.requestCount = 0;

    logger.info(`Circuit breaker '${this.config.name}' state transition: ${oldState} -> ${newState}`, {
      circuitBreaker: {
        name: this.config.name,
        oldState,
        newState,
        transitionTime: this.stateTransitionTime,
        metrics: this.getMetrics(),
      },
    });

    // Record state transition metric
    metricsCollector.recordMetric({
      name: 'circuit_breaker_state_transition',
      value: 1,
      timestamp: this.stateTransitionTime,
      labels: {
        name: this.config.name,
        from_state: oldState,
        to_state: newState,
      },
    });
  }

  /**
   * Add request to rolling window history
   */
  private addToHistory(success: boolean): void {
    this.requestHistory.push({
      timestamp: Date.now(),
      success,
    });

    // Limit history size to prevent memory leaks
    if (this.requestHistory.length > 1000) {
      this.requestHistory = this.requestHistory.slice(-500);
    }
  }

  /**
   * Clean up old entries from history
   */
  private cleanupHistory(): void {
    const cutoff = Date.now() - this.config.monitoringWindow;
    this.requestHistory = this.requestHistory.filter(
      req => req.timestamp >= cutoff
    );
  }

  /**
   * Record metrics for monitoring
   */
  private recordMetrics(
    outcome: 'success' | 'failure' | 'rejected',
    correlationId?: string,
    responseTime?: number,
    error?: Error
  ): void {
    metricsCollector.recordMetric({
      name: 'circuit_breaker_requests',
      value: 1,
      timestamp: Date.now(),
      labels: {
        name: this.config.name,
        state: this.state,
        outcome,
      },
      correlationId,
    });

    if (responseTime !== undefined) {
      metricsCollector.recordMetric({
        name: 'circuit_breaker_request_duration',
        value: responseTime,
        timestamp: Date.now(),
        labels: {
          name: this.config.name,
          outcome,
        },
        correlationId,
      });
    }

    // Record current state metrics
    metricsCollector.recordMetric({
      name: 'circuit_breaker_state',
      value: this.state === CircuitBreakerState.CLOSED ? 0 : 
             this.state === CircuitBreakerState.HALF_OPEN ? 1 : 2,
      timestamp: Date.now(),
      labels: {
        name: this.config.name,
        state: this.state,
      },
      correlationId,
    });
  }

  /**
   * Get current circuit breaker metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      requestCount: this.requestCount,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      stateTransitionTime: this.stateTransitionTime,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
    };
  }

  /**
   * Get failure rate in current monitoring window
   */
  getCurrentFailureRate(): number {
    const now = Date.now();
    const windowStart = now - this.config.monitoringWindow;
    const recentRequests = this.requestHistory.filter(
      req => req.timestamp >= windowStart
    );

    if (recentRequests.length === 0) {
      return 0;
    }

    const failures = recentRequests.filter(req => !req.success).length;
    return (failures / recentRequests.length) * 100;
  }

  /**
   * Check if circuit breaker is healthy
   */
  isHealthy(): boolean {
    return this.state === CircuitBreakerState.CLOSED;
  }

  /**
   * Force circuit breaker to specific state (for testing/maintenance)
   */
  forceState(state: CircuitBreakerState, reason?: string): void {
    logger.warn(`Circuit breaker '${this.config.name}' forced to state: ${state}`, {
      circuitBreaker: {
        name: this.config.name,
        forcedState: state,
        reason: reason || 'manual',
        previousState: this.state,
      },
    });

    this.transitionTo(state);
  }

  /**
   * Reset circuit breaker to initial state
   */
  reset(): void {
    logger.info(`Circuit breaker '${this.config.name}' reset to initial state`, {
      circuitBreaker: {
        name: this.config.name,
        previousMetrics: this.getMetrics(),
      },
    });

    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.requestCount = 0;
    this.lastFailureTime = undefined;
    this.lastSuccessTime = undefined;
    this.stateTransitionTime = Date.now();
    this.totalRequests = 0;
    this.totalFailures = 0;
    this.totalSuccesses = 0;
    this.requestHistory = [];
  }

  /**
   * Get circuit breaker name
   */
  getName(): string {
    return this.config.name;
  }

  /**
   * Get current state
   */
  getState(): CircuitBreakerState {
    return this.state;
  }
}