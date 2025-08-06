import { randomUUID } from 'crypto';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  correlationId?: string;
  requestId?: string;
  userId?: string;
  metadata?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  performance?: {
    duration: number;
    startTime: number;
    endTime: number;
  };
  context?: {
    service: string;
    version: string;
    environment: string;
    component: string;
  };
}

export interface LoggerConfig {
  level: LogLevel;
  service: string;
  version: string;
  environment: string;
  enableConsole: boolean;
  enableFile: boolean;
  filePath?: string;
  enableStructuredLogging: boolean;
  enableCorrelationIds: boolean;
}

export class StructuredLogger {
  private config: LoggerConfig;
  private logBuffer: LogEntry[] = [];
  private readonly maxBufferSize = 1000;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: LogLevel.INFO,
      service: 'ai-app-generator',
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      enableConsole: true,
      enableFile: false,
      enableStructuredLogging: true,
      enableCorrelationIds: true,
      ...config,
    };
  }

  // Core logging methods
  debug(message: string, metadata?: Record<string, any>, correlationId?: string): void {
    this.log(LogLevel.DEBUG, message, metadata, correlationId);
  }

  info(message: string, metadata?: Record<string, any>, correlationId?: string): void {
    this.log(LogLevel.INFO, message, metadata, correlationId);
  }

  warn(message: string, metadata?: Record<string, any>, correlationId?: string): void {
    this.log(LogLevel.WARN, message, metadata, correlationId);
  }

  error(message: string, error?: Error, metadata?: Record<string, any>, correlationId?: string): void {
    const errorData = error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : undefined;

    this.log(LogLevel.ERROR, message, metadata, correlationId, errorData);
  }

  fatal(message: string, error?: Error, metadata?: Record<string, any>, correlationId?: string): void {
    const errorData = error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : undefined;

    this.log(LogLevel.FATAL, message, metadata, correlationId, errorData);
  }

  // Request-specific logging
  request(
    method: string,
    path: string,
    statusCode: number,
    responseTime: number,
    metadata?: Record<string, any>,
    correlationId?: string
  ): void {
    this.info(`${method} ${path} ${statusCode}`, {
      request: {
        method,
        path,
        statusCode,
        responseTime,
      },
      ...metadata,
    }, correlationId);
  }

  // AI generation logging
  generation(
    prompt: string,
    success: boolean,
    provider: string,
    model: string,
    responseTime: number,
    fallbackUsed: boolean,
    metadata?: Record<string, any>,
    correlationId?: string,
    error?: Error
  ): void {
    const level = success ? LogLevel.INFO : LogLevel.ERROR;
    const message = `AI generation ${success ? 'succeeded' : 'failed'}: ${provider}/${model}`;

    this.log(level, message, {
      generation: {
        prompt: prompt.slice(0, 100), // Truncate for logging
        success,
        provider,
        model,
        responseTime,
        fallbackUsed,
      },
      ...metadata,
    }, correlationId, error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : undefined);
  }

  // Security logging
  security(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    details: Record<string, any>,
    correlationId?: string
  ): void {
    const level = severity === 'critical' || severity === 'high' ? LogLevel.ERROR : LogLevel.WARN;
    
    this.log(level, `Security event: ${event}`, {
      security: {
        event,
        severity,
        ...details,
      },
    }, correlationId);
  }

  // Performance logging
  performance(
    operation: string,
    duration: number,
    metadata?: Record<string, any>,
    correlationId?: string
  ): void {
    this.info(`Performance: ${operation}`, {
      performance: {
        operation,
        duration,
      },
      ...metadata,
    }, correlationId);
  }

  // Cache logging
  cache(
    operation: 'hit' | 'miss' | 'set' | 'evict',
    key: string,
    metadata?: Record<string, any>,
    correlationId?: string
  ): void {
    this.debug(`Cache ${operation}: ${key}`, {
      cache: {
        operation,
        key,
      },
      ...metadata,
    }, correlationId);
  }

  // Database logging
  database(
    operation: string,
    table: string,
    duration: number,
    success: boolean,
    metadata?: Record<string, any>,
    correlationId?: string,
    error?: Error
  ): void {
    const level = success ? LogLevel.DEBUG : LogLevel.ERROR;
    const message = `Database ${operation} on ${table} ${success ? 'succeeded' : 'failed'}`;

    this.log(level, message, {
      database: {
        operation,
        table,
        duration,
        success,
      },
      ...metadata,
    }, correlationId, error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : undefined);
  }

  // Core logging implementation
  private log(
    level: LogLevel,
    message: string,
    metadata?: Record<string, any>,
    correlationId?: string,
    error?: LogEntry['error']
  ): void {
    if (level < this.config.level) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      correlationId: correlationId || (this.config.enableCorrelationIds ? randomUUID() : undefined),
      metadata,
      error,
      context: {
        service: this.config.service,
        version: this.config.version,
        environment: this.config.environment,
        component: 'api-server',
      },
    };

    // Add to buffer
    this.logBuffer.push(entry);
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }

    // Output to console
    if (this.config.enableConsole) {
      this.outputToConsole(entry);
    }

    // Output to file (simplified for PoC)
    if (this.config.enableFile && this.config.filePath) {
      this.outputToFile(entry);
    }
  }

  private outputToConsole(entry: LogEntry): void {
    const levelName = LogLevel[entry.level];
    const timestamp = entry.timestamp;
    const correlationId = entry.correlationId ? ` [${entry.correlationId.slice(0, 8)}]` : '';

    if (this.config.enableStructuredLogging) {
      // Structured JSON output
      console.log(JSON.stringify(entry));
    } else {
      // Human-readable format
      const message = `[${timestamp}] ${levelName}${correlationId}: ${entry.message}`;
      
      switch (entry.level) {
        case LogLevel.DEBUG:
          console.debug(message, entry.metadata || '');
          break;
        case LogLevel.INFO:
          console.info(message, entry.metadata || '');
          break;
        case LogLevel.WARN:
          console.warn(message, entry.metadata || '');
          break;
        case LogLevel.ERROR:
        case LogLevel.FATAL:
          console.error(message, entry.metadata || '', entry.error || '');
          break;
      }
    }
  }

  private outputToFile(entry: LogEntry): void {
    // In a real implementation, this would write to a file
    // For this PoC, we'll just simulate it
    try {
      const logLine = JSON.stringify(entry) + '\n';
      // Would use fs.appendFileSync or async file writing here
      // fs.appendFileSync(this.config.filePath!, logLine);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  // Utility methods
  createChildLogger(component: string, additionalMetadata?: Record<string, any>): ChildLogger {
    return new ChildLogger(this, component, additionalMetadata);
  }

  // Get recent logs for debugging
  getRecentLogs(count: number = 100): LogEntry[] {
    return this.logBuffer.slice(-count);
  }

  // Get logs by level
  getLogsByLevel(level: LogLevel, limit: number = 100): LogEntry[] {
    return this.logBuffer
      .filter(entry => entry.level >= level)
      .slice(-limit);
  }

  // Get logs by correlation ID
  getLogsByCorrelationId(correlationId: string): LogEntry[] {
    return this.logBuffer.filter(entry => entry.correlationId === correlationId);
  }

  // Health check for logger
  isHealthy(): boolean {
    try {
      this.debug('Health check test log');
      return true;
    } catch (error) {
      return false;
    }
  }

  // Metrics for monitoring
  getLogMetrics(): {
    totalLogs: number;
    logsByLevel: Record<string, number>;
    recentErrorCount: number;
    bufferUtilization: number;
  } {
    const logsByLevel = this.logBuffer.reduce((acc, entry) => {
      const levelName = LogLevel[entry.level];
      acc[levelName] = (acc[levelName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    const recentErrors = this.logBuffer.filter(entry => 
      entry.level >= LogLevel.ERROR && 
      new Date(entry.timestamp).getTime() >= fiveMinutesAgo
    );

    return {
      totalLogs: this.logBuffer.length,
      logsByLevel,
      recentErrorCount: recentErrors.length,
      bufferUtilization: (this.logBuffer.length / this.maxBufferSize) * 100,
    };
  }
}

// Child logger for component-specific logging
export class ChildLogger {
  constructor(
    private parent: StructuredLogger,
    private component: string,
    private defaultMetadata: Record<string, any> = {}
  ) {}

  private mergeMetadata(metadata?: Record<string, any>): Record<string, any> {
    return {
      component: this.component,
      ...this.defaultMetadata,
      ...metadata,
    };
  }

  debug(message: string, metadata?: Record<string, any>, correlationId?: string): void {
    this.parent.debug(message, this.mergeMetadata(metadata), correlationId);
  }

  info(message: string, metadata?: Record<string, any>, correlationId?: string): void {
    this.parent.info(message, this.mergeMetadata(metadata), correlationId);
  }

  warn(message: string, metadata?: Record<string, any>, correlationId?: string): void {
    this.parent.warn(message, this.mergeMetadata(metadata), correlationId);
  }

  error(message: string, error?: Error, metadata?: Record<string, any>, correlationId?: string): void {
    this.parent.error(message, error, this.mergeMetadata(metadata), correlationId);
  }

  fatal(message: string, error?: Error, metadata?: Record<string, any>, correlationId?: string): void {
    this.parent.fatal(message, error, this.mergeMetadata(metadata), correlationId);
  }

  request(
    method: string,
    path: string,
    statusCode: number,
    responseTime: number,
    metadata?: Record<string, any>,
    correlationId?: string
  ): void {
    this.parent.request(method, path, statusCode, responseTime, this.mergeMetadata(metadata), correlationId);
  }

  generation(
    prompt: string,
    success: boolean,
    provider: string,
    model: string,
    responseTime: number,
    fallbackUsed: boolean,
    metadata?: Record<string, any>,
    correlationId?: string,
    error?: Error
  ): void {
    this.parent.generation(
      prompt, success, provider, model, responseTime, fallbackUsed,
      this.mergeMetadata(metadata), correlationId, error
    );
  }

  security(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    details: Record<string, any>,
    correlationId?: string
  ): void {
    this.parent.security(event, severity, { ...details, component: this.component }, correlationId);
  }

  performance(
    operation: string,
    duration: number,
    metadata?: Record<string, any>,
    correlationId?: string
  ): void {
    this.parent.performance(operation, duration, this.mergeMetadata(metadata), correlationId);
  }

  cache(
    operation: 'hit' | 'miss' | 'set' | 'evict',
    key: string,
    metadata?: Record<string, any>,
    correlationId?: string
  ): void {
    this.parent.cache(operation, key, this.mergeMetadata(metadata), correlationId);
  }

  database(
    operation: string,
    table: string,
    duration: number,
    success: boolean,
    metadata?: Record<string, any>,
    correlationId?: string,
    error?: Error
  ): void {
    this.parent.database(operation, table, duration, success, this.mergeMetadata(metadata), correlationId, error);
  }
}

// Global logger instance
export const logger = new StructuredLogger({
  level: process.env.LOG_LEVEL ? parseInt(process.env.LOG_LEVEL) : LogLevel.INFO,
  enableStructuredLogging: process.env.NODE_ENV === 'production',
  enableFile: process.env.NODE_ENV === 'production',
  filePath: process.env.LOG_FILE_PATH || './logs/app.log',
});

// Correlation ID utilities
export function generateCorrelationId(): string {
  return randomUUID();
}

export function extractCorrelationId(request: Request): string | undefined {
  return request.headers.get('x-correlation-id') || 
         request.headers.get('x-request-id') ||
         generateCorrelationId();
}