/**
 * Comprehensive error handling system for AI App Generator
 * 
 * This module provides structured error types, validation utilities,
 * and error recovery strategies for better debugging and user experience.
 */

// Base error class with enhanced functionality
export abstract class AppGeneratorError extends Error {
  public readonly code: string;
  public readonly context?: Record<string, unknown>;
  public readonly timestamp: Date;
  public readonly recoverable: boolean;

  constructor(
    message: string,
    code: string,
    context?: Record<string, unknown>,
    recoverable: boolean = false
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.context = context;
    this.timestamp = new Date();
    this.recoverable = recoverable;

    // Maintains proper stack trace for V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
      recoverable: this.recoverable,
      stack: this.stack
    };
  }

  public toString(): string {
    const contextStr = this.context ? ` (${JSON.stringify(this.context)})` : '';
    return `[${this.code}] ${this.message}${contextStr}`;
  }
}

// Template-related errors
export class TemplateError extends AppGeneratorError {
  constructor(
    message: string,
    context?: Record<string, unknown>,
    recoverable: boolean = true
  ) {
    super(message, 'TEMPLATE_ERROR', context, recoverable);
  }
}

export class TemplateNotFoundError extends TemplateError {
  constructor(templateId: string, availableTemplates?: string[]) {
    super(
      `Template '${templateId}' not found`,
      { templateId, availableTemplates },
      true
    );
    this.code = 'TEMPLATE_NOT_FOUND';
  }
}

export class TemplateLoadError extends TemplateError {
  constructor(templateId: string, cause: Error) {
    super(
      `Failed to load template '${templateId}': ${cause.message}`,
      { templateId, originalError: cause.message },
      true
    );
    this.code = 'TEMPLATE_LOAD_ERROR';
  }
}

export class TemplateValidationError extends TemplateError {
  constructor(templateId: string, validationErrors: string[]) {
    super(
      `Template '${templateId}' validation failed`,
      { templateId, validationErrors },
      false
    );
    this.code = 'TEMPLATE_VALIDATION_ERROR';
  }
}

export class TemplateInterpolationError extends TemplateError {
  constructor(templateId: string, variableName: string, cause?: Error) {
    super(
      `Failed to interpolate variable '${variableName}' in template '${templateId}'`,
      { templateId, variableName, originalError: cause?.message },
      true
    );
    this.code = 'TEMPLATE_INTERPOLATION_ERROR';
  }
}

// Component-related errors
export class ComponentError extends AppGeneratorError {
  constructor(
    message: string,
    context?: Record<string, unknown>,
    recoverable: boolean = true
  ) {
    super(message, 'COMPONENT_ERROR', context, recoverable);
  }
}

export class ComponentNotFoundError extends ComponentError {
  constructor(componentType: string, availableTypes?: string[]) {
    super(
      `Component type '${componentType}' not found`,
      { componentType, availableTypes },
      true
    );
    this.code = 'COMPONENT_NOT_FOUND';
  }
}

export class ComponentValidationError extends ComponentError {
  constructor(componentType: string, validationErrors: string[]) {
    super(
      `Component '${componentType}' validation failed`,
      { componentType, validationErrors },
      false
    );
    this.code = 'COMPONENT_VALIDATION_ERROR';
  }
}

export class ComponentCompatibilityError extends ComponentError {
  constructor(componentType: string, platform: string, issues: string[]) {
    super(
      `Component '${componentType}' is not compatible with platform '${platform}'`,
      { componentType, platform, issues },
      true
    );
    this.code = 'COMPONENT_COMPATIBILITY_ERROR';
  }
}

export class ComponentDependencyError extends ComponentError {
  constructor(componentType: string, missingDependencies: string[]) {
    super(
      `Component '${componentType}' has missing dependencies`,
      { componentType, missingDependencies },
      true
    );
    this.code = 'COMPONENT_DEPENDENCY_ERROR';
  }
}

// Rule engine errors
export class RuleError extends AppGeneratorError {
  constructor(
    message: string,
    context?: Record<string, unknown>,
    recoverable: boolean = true
  ) {
    super(message, 'RULE_ERROR', context, recoverable);
  }
}

export class RuleValidationError extends RuleError {
  constructor(ruleId: string, validationErrors: string[]) {
    super(
      `Rule '${ruleId}' validation failed`,
      { ruleId, validationErrors },
      false
    );
    this.code = 'RULE_VALIDATION_ERROR';
  }
}

export class RuleExecutionError extends RuleError {
  constructor(ruleId: string, cause: Error) {
    super(
      `Rule '${ruleId}' execution failed: ${cause.message}`,
      { ruleId, originalError: cause.message },
      true
    );
    this.code = 'RULE_EXECUTION_ERROR';
  }
}

export class RuleConfigurationError extends RuleError {
  constructor(ruleId: string, configErrors: string[]) {
    super(
      `Rule '${ruleId}' configuration is invalid`,
      { ruleId, configErrors },
      false
    );
    this.code = 'RULE_CONFIGURATION_ERROR';
  }
}

// Configuration errors
export class ConfigError extends AppGeneratorError {
  constructor(
    message: string,
    context?: Record<string, unknown>,
    recoverable: boolean = true
  ) {
    super(message, 'CONFIG_ERROR', context, recoverable);
  }
}

export class ConfigLoadError extends ConfigError {
  constructor(configPath: string, cause: Error) {
    super(
      `Failed to load configuration from '${configPath}': ${cause.message}`,
      { configPath, originalError: cause.message },
      true
    );
    this.code = 'CONFIG_LOAD_ERROR';
  }
}

export class ConfigValidationError extends ConfigError {
  constructor(validationErrors: string[]) {
    super(
      'Configuration validation failed',
      { validationErrors },
      false
    );
    this.code = 'CONFIG_VALIDATION_ERROR';
  }
}

export class ConfigSaveError extends ConfigError {
  constructor(configPath: string, cause: Error) {
    super(
      `Failed to save configuration to '${configPath}': ${cause.message}`,
      { configPath, originalError: cause.message },
      true
    );
    this.code = 'CONFIG_SAVE_ERROR';
  }
}

// AI Generation errors
export class GenerationError extends AppGeneratorError {
  constructor(
    message: string,
    context?: Record<string, unknown>,
    recoverable: boolean = true
  ) {
    super(message, 'GENERATION_ERROR', context, recoverable);
  }
}

export class PromptValidationError extends GenerationError {
  constructor(prompt: string, validationErrors: string[]) {
    super(
      'User prompt validation failed',
      { prompt: prompt.slice(0, 100), validationErrors },
      false
    );
    this.code = 'PROMPT_VALIDATION_ERROR';
  }
}

export class GenerationTimeoutError extends GenerationError {
  constructor(timeoutMs: number) {
    super(
      `App generation timed out after ${timeoutMs}ms`,
      { timeoutMs },
      true
    );
    this.code = 'GENERATION_TIMEOUT_ERROR';
  }
}

export class GenerationFallbackError extends GenerationError {
  constructor(originalError: Error, fallbackAttempts: number) {
    super(
      `Generation failed and all ${fallbackAttempts} fallback attempts exhausted`,
      { originalError: originalError.message, fallbackAttempts },
      false
    );
    this.code = 'GENERATION_FALLBACK_ERROR';
  }
}

// Input validation errors
export class ValidationError extends AppGeneratorError {
  constructor(
    fieldName: string,
    value: unknown,
    validationErrors: string[]
  ) {
    super(
      `Validation failed for field '${fieldName}'`,
      { fieldName, value, validationErrors },
      false
    );
    this.code = 'VALIDATION_ERROR';
  }
}

// Network/Service errors
export class ServiceError extends AppGeneratorError {
  constructor(
    serviceName: string,
    message: string,
    context?: Record<string, unknown>,
    recoverable: boolean = true
  ) {
    super(
      `Service '${serviceName}' error: ${message}`,
      { serviceName, ...context },
      recoverable
    );
    this.code = 'SERVICE_ERROR';
  }
}

export class NetworkError extends ServiceError {
  constructor(url: string, cause: Error, retryCount: number = 0) {
    super(
      'network',
      `Network request failed for '${url}': ${cause.message}`,
      { url, originalError: cause.message, retryCount },
      retryCount < 3 // Recoverable if retry count is low
    );
    this.code = 'NETWORK_ERROR';
  }
}

export class TimeoutError extends ServiceError {
  constructor(serviceName: string, timeoutMs: number) {
    super(
      serviceName,
      `Operation timed out after ${timeoutMs}ms`,
      { timeoutMs },
      true
    );
    this.code = 'TIMEOUT_ERROR';
  }
}

// Utility functions for error handling
export class ErrorHandler {
  /**
   * Wraps an async function with error handling and optional retry logic
   */
  static async withRetry<T>(
    operation: () => Promise<T>,
    options: {
      maxRetries?: number;
      retryDelay?: number;
      retryCondition?: (error: Error) => boolean;
      onRetry?: (error: Error, attempt: number) => void;
    } = {}
  ): Promise<T> {
    const {
      maxRetries = 3,
      retryDelay = 1000,
      retryCondition = (error) => error instanceof AppGeneratorError && error.recoverable,
      onRetry = () => {}
    } = options;

    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries || !retryCondition(lastError)) {
          throw lastError;
        }

        onRetry(lastError, attempt + 1);
        
        if (retryDelay > 0) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
        }
      }
    }

    throw lastError!;
  }

  /**
   * Wraps a function with fallback logic
   */
  static async withFallback<T>(
    primary: () => Promise<T>,
    fallback: (error: Error) => Promise<T>,
    options: {
      shouldFallback?: (error: Error) => boolean;
      onFallback?: (error: Error) => void;
    } = {}
  ): Promise<T> {
    const {
      shouldFallback = (error) => error instanceof AppGeneratorError && error.recoverable,
      onFallback = () => {}
    } = options;

    try {
      return await primary();
    } catch (error) {
      const err = error as Error;
      
      if (shouldFallback(err)) {
        onFallback(err);
        return await fallback(err);
      }
      
      throw error;
    }
  }

  /**
   * Safely handles async operations with proper error conversion
   */
  static async safe<T>(
    operation: () => Promise<T>,
    defaultValue: T,
    options: {
      logError?: boolean;
      onError?: (error: Error) => void;
    } = {}
  ): Promise<T> {
    const { logError = true, onError } = options;

    try {
      return await operation();
    } catch (error) {
      const err = error as Error;
      
      if (logError) {
        console.error('Safe operation failed:', err);
      }
      
      if (onError) {
        onError(err);
      }
      
      return defaultValue;
    }
  }

  /**
   * Creates a circuit breaker pattern for service calls
   */
  static createCircuitBreaker<T extends unknown[], R>(
    fn: (...args: T) => Promise<R>,
    options: {
      failureThreshold?: number;
      recoveryTime?: number;
      onStateChange?: (state: 'CLOSED' | 'OPEN' | 'HALF_OPEN') => void;
    } = {}
  ): (...args: T) => Promise<R> {
    const {
      failureThreshold = 5,
      recoveryTime = 60000,
      onStateChange = () => {}
    } = options;

    let state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
    let failureCount = 0;
    let lastFailureTime = 0;

    return async (...args: T): Promise<R> => {
      const now = Date.now();

      // Check if we should transition from OPEN to HALF_OPEN
      if (state === 'OPEN' && now - lastFailureTime > recoveryTime) {
        state = 'HALF_OPEN';
        onStateChange(state);
      }

      // Reject immediately if circuit is open
      if (state === 'OPEN') {
        throw new ServiceError(
          'circuit-breaker',
          'Circuit breaker is OPEN - too many failures',
          { failureCount, lastFailureTime },
          false
        );
      }

      try {
        const result = await fn(...args);
        
        // Success - reset failure count and close circuit if half-open
        if (state === 'HALF_OPEN') {
          state = 'CLOSED';
          onStateChange(state);
        }
        failureCount = 0;
        
        return result;
      } catch (error) {
        failureCount++;
        lastFailureTime = now;

        // Open circuit if failure threshold exceeded
        if (failureCount >= failureThreshold) {
          state = 'OPEN';
          onStateChange(state);
        }

        throw error;
      }
    };
  }
}

/**
 * Type-safe error result pattern (similar to Rust's Result type)
 */
export type Result<T, E = Error> = 
  | { success: true; data: T; error?: never }
  | { success: false; data?: never; error: E };

export class ResultUtils {
  static ok<T>(data: T): Result<T> {
    return { success: true, data };
  }

  static err<E = Error>(error: E): Result<never, E> {
    return { success: false, error };
  }

  static async fromAsync<T>(
    promise: Promise<T>
  ): Promise<Result<T>> {
    try {
      const data = await promise;
      return ResultUtils.ok(data);
    } catch (error) {
      return ResultUtils.err(error as Error);
    }
  }

  static unwrap<T>(result: Result<T>): T {
    if (result.success) {
      return result.data;
    }
    throw result.error;
  }

  static unwrapOr<T>(result: Result<T>, defaultValue: T): T {
    return result.success ? result.data : defaultValue;
  }

  static map<T, U>(
    result: Result<T>,
    fn: (data: T) => U
  ): Result<U> {
    return result.success 
      ? ResultUtils.ok(fn(result.data))
      : result;
  }

  static mapError<T, E1, E2>(
    result: Result<T, E1>,
    fn: (error: E1) => E2
  ): Result<T, E2> {
    return result.success 
      ? result
      : ResultUtils.err(fn(result.error));
  }
}

/**
 * Error aggregation utilities for batch operations
 */
export class ErrorAggregator {
  private errors: AppGeneratorError[] = [];

  add(error: AppGeneratorError): void {
    this.errors.push(error);
  }

  addValidation(fieldName: string, value: unknown, errors: string[]): void {
    if (errors.length > 0) {
      this.add(new ValidationError(fieldName, value, errors));
    }
  }

  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  getErrors(): AppGeneratorError[] {
    return [...this.errors];
  }

  getCriticalErrors(): AppGeneratorError[] {
    return this.errors.filter(error => !error.recoverable);
  }

  getRecoverableErrors(): AppGeneratorError[] {
    return this.errors.filter(error => error.recoverable);
  }

  throwIfCritical(): void {
    const critical = this.getCriticalErrors();
    if (critical.length > 0) {
      if (critical.length === 1) {
        throw critical[0];
      } else {
        throw new AppGeneratorError(
          `Multiple critical errors occurred: ${critical.map(e => e.message).join('; ')}`,
          'MULTIPLE_CRITICAL_ERRORS',
          { errors: critical.map(e => e.toJSON()) },
          false
        );
      }
    }
  }

  clear(): void {
    this.errors = [];
  }

  summary(): string {
    if (this.errors.length === 0) {
      return 'No errors';
    }

    const critical = this.getCriticalErrors().length;
    const recoverable = this.getRecoverableErrors().length;
    
    return `${this.errors.length} total errors (${critical} critical, ${recoverable} recoverable)`;
  }
}