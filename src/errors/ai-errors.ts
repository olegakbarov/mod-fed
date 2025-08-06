// Base error class for all AI App Generator errors
export abstract class AIAppGeneratorError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly retryable: boolean;
  public readonly timestamp: number;
  public readonly correlationId?: string;
  public readonly context?: Record<string, any>;

  constructor(
    message: string,
    code: string,
    statusCode: number,
    retryable: boolean = false,
    correlationId?: string,
    context?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = retryable;
    this.timestamp = Date.now();
    this.correlationId = correlationId;
    this.context = context;

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      retryable: this.retryable,
      timestamp: this.timestamp,
      correlationId: this.correlationId,
      context: this.context,
      stack: this.stack,
    };
  }
}

// AI Provider Errors
export class AIProviderError extends AIAppGeneratorError {
  constructor(
    message: string,
    provider: string,
    model: string,
    retryable: boolean = true,
    correlationId?: string,
    originalError?: Error
  ) {
    super(
      message,
      'AI_PROVIDER_ERROR',
      502,
      retryable,
      correlationId,
      {
        provider,
        model,
        originalError: originalError ? {
          name: originalError.name,
          message: originalError.message,
          stack: originalError.stack,
        } : undefined,
      }
    );
  }
}

export class AIRateLimitError extends AIAppGeneratorError {
  public readonly resetTime?: number;
  public readonly limitType: 'requests' | 'tokens' | 'concurrent';

  constructor(
    message: string,
    provider: string,
    limitType: 'requests' | 'tokens' | 'concurrent',
    resetTime?: number,
    correlationId?: string
  ) {
    super(
      message,
      'AI_RATE_LIMIT_ERROR',
      429,
      true, // Rate limits are typically retryable
      correlationId,
      {
        provider,
        limitType,
        resetTime,
      }
    );

    this.resetTime = resetTime;
    this.limitType = limitType;
  }
}

export class AIAuthenticationError extends AIAppGeneratorError {
  constructor(
    message: string,
    provider: string,
    correlationId?: string
  ) {
    super(
      message,
      'AI_AUTHENTICATION_ERROR',
      401,
      false, // Auth errors are usually not retryable without fixing the credentials
      correlationId,
      { provider }
    );
  }
}

export class AIQuotaExceededError extends AIAppGeneratorError {
  public readonly quotaType: 'daily' | 'monthly' | 'credits';
  public readonly resetTime?: number;

  constructor(
    message: string,
    provider: string,
    quotaType: 'daily' | 'monthly' | 'credits',
    resetTime?: number,
    correlationId?: string
  ) {
    super(
      message,
      'AI_QUOTA_EXCEEDED_ERROR',
      402,
      quotaType !== 'credits', // Credits usually need manual action, but daily/monthly might reset
      correlationId,
      {
        provider,
        quotaType,
        resetTime,
      }
    );

    this.quotaType = quotaType;
    this.resetTime = resetTime;
  }
}

export class AIModelUnavailableError extends AIAppGeneratorError {
  public readonly model: string;

  constructor(
    message: string,
    provider: string,
    model: string,
    correlationId?: string
  ) {
    super(
      message,
      'AI_MODEL_UNAVAILABLE_ERROR',
      503,
      true, // Model availability issues are usually temporary
      correlationId,
      { provider, model }
    );

    this.model = model;
  }
}

export class AIGenerationTimeoutError extends AIAppGeneratorError {
  public readonly timeoutMs: number;

  constructor(
    message: string,
    timeoutMs: number,
    correlationId?: string
  ) {
    super(
      message,
      'AI_GENERATION_TIMEOUT_ERROR',
      504,
      true, // Timeouts are retryable
      correlationId,
      { timeoutMs }
    );

    this.timeoutMs = timeoutMs;
  }
}

export class AIInvalidResponseError extends AIAppGeneratorError {
  public readonly response?: string;

  constructor(
    message: string,
    provider: string,
    response?: string,
    correlationId?: string
  ) {
    super(
      message,
      'AI_INVALID_RESPONSE_ERROR',
      502,
      true, // Invalid responses might be temporary issues
      correlationId,
      {
        provider,
        response: response ? response.slice(0, 200) : undefined, // Truncate for logging
      }
    );

    this.response = response;
  }
}

// Validation Errors
export class ValidationError extends AIAppGeneratorError {
  public readonly field?: string;
  public readonly value?: any;

  constructor(
    message: string,
    field?: string,
    value?: any,
    correlationId?: string
  ) {
    super(
      message,
      'VALIDATION_ERROR',
      400,
      false, // Validation errors are not retryable without fixing the input
      correlationId,
      { field, value }
    );

    this.field = field;
    this.value = value;
  }
}

export class SchemaValidationError extends ValidationError {
  public readonly schema: string;
  public readonly violations: string[];

  constructor(
    message: string,
    schema: string,
    violations: string[],
    correlationId?: string
  ) {
    super(
      message,
      undefined,
      undefined,
      correlationId
    );

    this.code = 'SCHEMA_VALIDATION_ERROR';
    this.schema = schema;
    this.violations = violations;
    this.context = {
      ...this.context,
      schema,
      violations,
    };
  }
}

// Database Errors
export class DatabaseError extends AIAppGeneratorError {
  public readonly operation: string;
  public readonly table?: string;

  constructor(
    message: string,
    operation: string,
    table?: string,
    retryable: boolean = true,
    correlationId?: string,
    originalError?: Error
  ) {
    super(
      message,
      'DATABASE_ERROR',
      500,
      retryable,
      correlationId,
      {
        operation,
        table,
        originalError: originalError ? {
          name: originalError.name,
          message: originalError.message,
        } : undefined,
      }
    );

    this.operation = operation;
    this.table = table;
  }
}

export class DatabaseConnectionError extends DatabaseError {
  constructor(
    message: string,
    correlationId?: string,
    originalError?: Error
  ) {
    super(
      message,
      'connection',
      undefined,
      true,
      correlationId,
      originalError
    );

    this.code = 'DATABASE_CONNECTION_ERROR';
    this.statusCode = 503;
  }
}

export class DatabaseConstraintError extends DatabaseError {
  public readonly constraint: string;

  constructor(
    message: string,
    table: string,
    constraint: string,
    correlationId?: string
  ) {
    super(
      message,
      'constraint_violation',
      table,
      false, // Constraint violations usually need data fixes
      correlationId
    );

    this.code = 'DATABASE_CONSTRAINT_ERROR';
    this.statusCode = 409;
    this.constraint = constraint;
    this.context = {
      ...this.context,
      constraint,
    };
  }
}

// Cache Errors
export class CacheError extends AIAppGeneratorError {
  public readonly operation: string;
  public readonly key?: string;

  constructor(
    message: string,
    operation: string,
    key?: string,
    correlationId?: string,
    originalError?: Error
  ) {
    super(
      message,
      'CACHE_ERROR',
      500,
      true, // Cache errors are usually retryable
      correlationId,
      {
        operation,
        key,
        originalError: originalError ? {
          name: originalError.name,
          message: originalError.message,
        } : undefined,
      }
    );

    this.operation = operation;
    this.key = key;
  }
}

// Security Errors
export class SecurityError extends AIAppGeneratorError {
  public readonly securityEvent: string;
  public readonly clientIP?: string;

  constructor(
    message: string,
    securityEvent: string,
    clientIP?: string,
    correlationId?: string
  ) {
    super(
      message,
      'SECURITY_ERROR',
      403,
      false, // Security errors are usually not retryable
      correlationId,
      {
        securityEvent,
        clientIP,
      }
    );

    this.securityEvent = securityEvent;
    this.clientIP = clientIP;
  }
}

export class RateLimitExceededError extends SecurityError {
  public readonly limit: number;
  public readonly windowMs: number;
  public readonly resetTime: number;

  constructor(
    message: string,
    limit: number,
    windowMs: number,
    resetTime: number,
    clientIP?: string,
    correlationId?: string
  ) {
    super(
      message,
      'rate_limit_exceeded',
      clientIP,
      correlationId
    );

    this.code = 'RATE_LIMIT_EXCEEDED_ERROR';
    this.statusCode = 429;
    this.retryable = true; // Rate limits reset over time
    this.limit = limit;
    this.windowMs = windowMs;
    this.resetTime = resetTime;
    this.context = {
      ...this.context,
      limit,
      windowMs,
      resetTime,
    };
  }
}

export class AuthenticationError extends SecurityError {
  constructor(
    message: string,
    clientIP?: string,
    correlationId?: string
  ) {
    super(
      message,
      'authentication_failed',
      clientIP,
      correlationId
    );

    this.code = 'AUTHENTICATION_ERROR';
    this.statusCode = 401;
  }
}

export class AuthorizationError extends SecurityError {
  public readonly requiredPermission: string;

  constructor(
    message: string,
    requiredPermission: string,
    clientIP?: string,
    correlationId?: string
  ) {
    super(
      message,
      'authorization_failed',
      clientIP,
      correlationId
    );

    this.code = 'AUTHORIZATION_ERROR';
    this.statusCode = 403;
    this.requiredPermission = requiredPermission;
    this.context = {
      ...this.context,
      requiredPermission,
    };
  }
}

// Configuration Errors
export class ConfigurationError extends AIAppGeneratorError {
  public readonly configKey: string;

  constructor(
    message: string,
    configKey: string,
    correlationId?: string
  ) {
    super(
      message,
      'CONFIGURATION_ERROR',
      500,
      false, // Config errors need manual fixes
      correlationId,
      { configKey }
    );

    this.configKey = configKey;
  }
}

// Business Logic Errors
export class ComponentNotFoundError extends AIAppGeneratorError {
  public readonly componentType: string;

  constructor(
    componentType: string,
    correlationId?: string
  ) {
    super(
      `Component type '${componentType}' is not supported`,
      'COMPONENT_NOT_FOUND_ERROR',
      400,
      false,
      correlationId,
      { componentType }
    );

    this.componentType = componentType;
  }
}

export class AppSpecInvalidError extends ValidationError {
  public readonly spec: any;

  constructor(
    message: string,
    spec: any,
    correlationId?: string
  ) {
    super(
      message,
      'appSpec',
      spec,
      correlationId
    );

    this.code = 'APP_SPEC_INVALID_ERROR';
    this.spec = spec;
  }
}

// Error Classification Utilities
export function isRetryableError(error: Error): boolean {
  if (error instanceof AIAppGeneratorError) {
    return error.retryable;
  }

  // Check common Node.js error patterns
  if (error.message.includes('ETIMEDOUT') || 
      error.message.includes('ECONNRESET') ||
      error.message.includes('ENOTFOUND')) {
    return true;
  }

  return false;
}

export function getRetryDelay(error: Error, attemptNumber: number): number {
  if (error instanceof AIRateLimitError && error.resetTime) {
    return Math.max(0, error.resetTime - Date.now());
  }

  if (error instanceof RateLimitExceededError) {
    return Math.max(0, error.resetTime - Date.now());
  }

  // Exponential backoff: 2^attempt * 1000ms, max 30 seconds
  return Math.min(Math.pow(2, attemptNumber) * 1000, 30000);
}

export function categorizeError(error: Error): {
  category: 'client' | 'server' | 'network' | 'dependency' | 'configuration';
  severity: 'low' | 'medium' | 'high' | 'critical';
  actionRequired: 'none' | 'retry' | 'fix_input' | 'check_config' | 'investigate';
} {
  if (error instanceof AIAppGeneratorError) {
    // Client errors (4xx)
    if (error.statusCode >= 400 && error.statusCode < 500) {
      return {
        category: 'client',
        severity: error.statusCode === 401 || error.statusCode === 403 ? 'high' : 'medium',
        actionRequired: error.retryable ? 'retry' : 'fix_input',
      };
    }

    // Server errors (5xx)
    if (error.statusCode >= 500) {
      return {
        category: 'server',
        severity: error.statusCode === 503 ? 'high' : 'critical',
        actionRequired: error.retryable ? 'retry' : 'investigate',
      };
    }
  }

  // Configuration errors
  if (error instanceof ConfigurationError) {
    return {
      category: 'configuration',
      severity: 'critical',
      actionRequired: 'check_config',
    };
  }

  // Database/dependency errors
  if (error instanceof DatabaseError) {
    return {
      category: 'dependency',
      severity: error.retryable ? 'high' : 'critical',
      actionRequired: error.retryable ? 'retry' : 'investigate',
    };
  }

  // Network errors
  if (error.message.includes('ETIMEDOUT') || error.message.includes('ECONNRESET')) {
    return {
      category: 'network',
      severity: 'medium',
      actionRequired: 'retry',
    };
  }

  // Default classification for unknown errors
  return {
    category: 'server',
    severity: 'high',
    actionRequired: 'investigate',
  };
}

// Error reporting utilities
export function sanitizeErrorForLogging(error: Error): Record<string, any> {
  if (error instanceof AIAppGeneratorError) {
    return error.toJSON();
  }

  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    timestamp: Date.now(),
  };
}

export function sanitizeErrorForResponse(error: Error, includeStack: boolean = false): Record<string, any> {
  const sanitized: Record<string, any> = {
    error: error.message,
    timestamp: new Date().toISOString(),
  };

  if (error instanceof AIAppGeneratorError) {
    sanitized.code = error.code;
    sanitized.retryable = error.retryable;
    
    if (error.correlationId) {
      sanitized.correlationId = error.correlationId;
    }

    // Include retry information if applicable
    if (error.retryable) {
      if (error instanceof AIRateLimitError && error.resetTime) {
        sanitized.retryAfter = Math.ceil((error.resetTime - Date.now()) / 1000);
      } else if (error instanceof RateLimitExceededError) {
        sanitized.retryAfter = Math.ceil((error.resetTime - Date.now()) / 1000);
      }
    }
  }

  if (includeStack && process.env.NODE_ENV !== 'production') {
    sanitized.stack = error.stack;
  }

  return sanitized;
}