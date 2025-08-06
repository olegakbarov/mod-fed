import { CircuitBreakerConfig } from '../utils/circuit-breaker';
import { BulkheadConfig } from '../utils/bulkhead';

/**
 * Resilience configuration for circuit breakers and bulkheads
 * Supports environment variable overrides for production deployments
 */

// Circuit Breaker configurations
export const CIRCUIT_BREAKER_CONFIGS = {
  AI_GENERATION: {
    name: 'ai-generation',
    failureThreshold: parseInt(process.env.AI_CB_FAILURE_THRESHOLD || '5'), // 5 failures
    successThreshold: parseInt(process.env.AI_CB_SUCCESS_THRESHOLD || '3'), // 3 successes to close
    timeout: parseInt(process.env.AI_CB_TIMEOUT || '60000'), // 60 seconds recovery timeout
    monitoringWindow: parseInt(process.env.AI_CB_MONITORING_WINDOW || '60000'), // 1 minute window
    volumeThreshold: parseInt(process.env.AI_CB_VOLUME_THRESHOLD || '10'), // Minimum 10 requests
  } as CircuitBreakerConfig,

  AI_PROVIDER_OPENAI: {
    name: 'ai-provider-openai',
    failureThreshold: parseInt(process.env.OPENAI_CB_FAILURE_THRESHOLD || '3'),
    successThreshold: parseInt(process.env.OPENAI_CB_SUCCESS_THRESHOLD || '2'),
    timeout: parseInt(process.env.OPENAI_CB_TIMEOUT || '30000'), // 30 seconds
    monitoringWindow: parseInt(process.env.OPENAI_CB_MONITORING_WINDOW || '30000'),
    volumeThreshold: parseInt(process.env.OPENAI_CB_VOLUME_THRESHOLD || '5'),
  } as CircuitBreakerConfig,

  AI_PROVIDER_ANTHROPIC: {
    name: 'ai-provider-anthropic',
    failureThreshold: parseInt(process.env.ANTHROPIC_CB_FAILURE_THRESHOLD || '3'),
    successThreshold: parseInt(process.env.ANTHROPIC_CB_SUCCESS_THRESHOLD || '2'),
    timeout: parseInt(process.env.ANTHROPIC_CB_TIMEOUT || '30000'), // 30 seconds
    monitoringWindow: parseInt(process.env.ANTHROPIC_CB_MONITORING_WINDOW || '30000'),
    volumeThreshold: parseInt(process.env.ANTHROPIC_CB_VOLUME_THRESHOLD || '5'),
  } as CircuitBreakerConfig,

  DATABASE: {
    name: 'database',
    failureThreshold: parseInt(process.env.DB_CB_FAILURE_THRESHOLD || '5'),
    successThreshold: parseInt(process.env.DB_CB_SUCCESS_THRESHOLD || '3'),
    timeout: parseInt(process.env.DB_CB_TIMEOUT || '15000'), // 15 seconds
    monitoringWindow: parseInt(process.env.DB_CB_MONITORING_WINDOW || '30000'),
    volumeThreshold: parseInt(process.env.DB_CB_VOLUME_THRESHOLD || '10'),
  } as CircuitBreakerConfig,

  CACHE: {
    name: 'cache',
    failureThreshold: parseInt(process.env.CACHE_CB_FAILURE_THRESHOLD || '10'), // More tolerant
    successThreshold: parseInt(process.env.CACHE_CB_SUCCESS_THRESHOLD || '5'),
    timeout: parseInt(process.env.CACHE_CB_TIMEOUT || '10000'), // 10 seconds
    monitoringWindow: parseInt(process.env.CACHE_CB_MONITORING_WINDOW || '60000'),
    volumeThreshold: parseInt(process.env.CACHE_CB_VOLUME_THRESHOLD || '20'),
  } as CircuitBreakerConfig,
};

// Bulkhead configurations
export const BULKHEAD_CONFIGS = {
  AI_GENERATION: {
    name: 'ai-generation-bulkhead',
    maxConcurrentRequests: parseInt(process.env.AI_BH_MAX_CONCURRENT || '10'), // 10 concurrent AI calls
    maxQueueSize: parseInt(process.env.AI_BH_MAX_QUEUE_SIZE || '50'), // Queue up to 50 requests
    queueTimeout: parseInt(process.env.AI_BH_QUEUE_TIMEOUT || '30000'), // 30 seconds queue timeout
    enableMetrics: process.env.AI_BH_ENABLE_METRICS?.toLowerCase() !== 'false', // Default enabled
  } as BulkheadConfig,

  DATABASE: {
    name: 'database-bulkhead',
    maxConcurrentRequests: parseInt(process.env.DB_BH_MAX_CONCURRENT || '20'), // 20 concurrent DB operations
    maxQueueSize: parseInt(process.env.DB_BH_MAX_QUEUE_SIZE || '100'),
    queueTimeout: parseInt(process.env.DB_BH_QUEUE_TIMEOUT || '10000'), // 10 seconds
    enableMetrics: process.env.DB_BH_ENABLE_METRICS?.toLowerCase() !== 'false',
  } as BulkheadConfig,

  CACHE: {
    name: 'cache-bulkhead',
    maxConcurrentRequests: parseInt(process.env.CACHE_BH_MAX_CONCURRENT || '50'), // High concurrency for cache
    maxQueueSize: parseInt(process.env.CACHE_BH_MAX_QUEUE_SIZE || '200'),
    queueTimeout: parseInt(process.env.CACHE_BH_QUEUE_TIMEOUT || '5000'), // 5 seconds
    enableMetrics: process.env.CACHE_BH_ENABLE_METRICS?.toLowerCase() !== 'false',
  } as BulkheadConfig,

  HTTP_REQUESTS: {
    name: 'http-requests-bulkhead',
    maxConcurrentRequests: parseInt(process.env.HTTP_BH_MAX_CONCURRENT || '30'), // 30 concurrent HTTP requests
    maxQueueSize: parseInt(process.env.HTTP_BH_MAX_QUEUE_SIZE || '100'),
    queueTimeout: parseInt(process.env.HTTP_BH_QUEUE_TIMEOUT || '15000'), // 15 seconds
    enableMetrics: process.env.HTTP_BH_ENABLE_METRICS?.toLowerCase() !== 'false',
  } as BulkheadConfig,
};

// Environment-specific configurations
export const RESILIENCE_CONFIG = {
  // Global resilience settings
  enableCircuitBreakers: process.env.ENABLE_CIRCUIT_BREAKERS?.toLowerCase() !== 'false', // Default enabled
  enableBulkheads: process.env.ENABLE_BULKHEADS?.toLowerCase() !== 'false', // Default enabled
  
  // Monitoring and alerting
  enableResilienceMetrics: process.env.ENABLE_RESILIENCE_METRICS?.toLowerCase() !== 'false',
  metricsCollectionInterval: parseInt(process.env.RESILIENCE_METRICS_INTERVAL || '30000'), // 30 seconds
  
  // Health check configuration
  healthCheckInterval: parseInt(process.env.RESILIENCE_HEALTH_CHECK_INTERVAL || '60000'), // 1 minute
  alertOnUnhealthy: process.env.ALERT_ON_UNHEALTHY?.toLowerCase() !== 'false',
  
  // Emergency controls
  enableEmergencyShutdown: process.env.ENABLE_EMERGENCY_SHUTDOWN?.toLowerCase() === 'true', // Default disabled
  emergencyShutdownThreshold: parseInt(process.env.EMERGENCY_SHUTDOWN_THRESHOLD || '90'), // 90% failure rate
  
  // Development/debugging settings
  logResilienceEvents: process.env.NODE_ENV !== 'production' || 
                      process.env.LOG_RESILIENCE_EVENTS?.toLowerCase() === 'true',
  enableResilienceDebug: process.env.RESILIENCE_DEBUG?.toLowerCase() === 'true',
};

// Environment-specific overrides
const ENVIRONMENT_OVERRIDES = {
  development: {
    // More lenient settings for development
    AI_GENERATION: {
      ...CIRCUIT_BREAKER_CONFIGS.AI_GENERATION,
      failureThreshold: 10, // Higher threshold
      timeout: 30000, // Shorter recovery time
    },
    AI_GENERATION_BULKHEAD: {
      ...BULKHEAD_CONFIGS.AI_GENERATION,
      maxConcurrentRequests: 5, // Lower concurrency for dev
      queueTimeout: 60000, // Longer timeout for debugging
    },
  },
  
  testing: {
    // Fast settings for testing
    AI_GENERATION: {
      ...CIRCUIT_BREAKER_CONFIGS.AI_GENERATION,
      failureThreshold: 2,
      timeout: 1000, // Very fast recovery for tests
      monitoringWindow: 5000,
    },
    AI_GENERATION_BULKHEAD: {
      ...BULKHEAD_CONFIGS.AI_GENERATION,
      maxConcurrentRequests: 2,
      maxQueueSize: 5,
      queueTimeout: 1000,
    },
  },
  
  production: {
    // Production settings (use defaults from above)
    // These are already optimized for production use
  },
};

/**
 * Get circuit breaker configuration with environment overrides
 */
export function getCircuitBreakerConfig(name: keyof typeof CIRCUIT_BREAKER_CONFIGS): CircuitBreakerConfig {
  const baseConfig = CIRCUIT_BREAKER_CONFIGS[name];
  const environment = (process.env.NODE_ENV || 'development') as keyof typeof ENVIRONMENT_OVERRIDES;
  const envOverrides = ENVIRONMENT_OVERRIDES[environment];
  
  if (envOverrides && name in envOverrides) {
    return { ...baseConfig, ...(envOverrides as any)[name] };
  }
  
  return baseConfig;
}

/**
 * Get bulkhead configuration with environment overrides
 */
export function getBulkheadConfig(name: keyof typeof BULKHEAD_CONFIGS): BulkheadConfig {
  const baseConfig = BULKHEAD_CONFIGS[name];
  const environment = (process.env.NODE_ENV || 'development') as keyof typeof ENVIRONMENT_OVERRIDES;
  const envOverrides = ENVIRONMENT_OVERRIDES[environment];
  
  // Check for bulkhead-specific overrides
  const bulkheadName = `${name}_BULKHEAD` as keyof typeof envOverrides;
  if (envOverrides && bulkheadName in envOverrides) {
    return { ...baseConfig, ...(envOverrides as any)[bulkheadName] };
  }
  
  return baseConfig;
}

/**
 * Validate configuration values
 */
export function validateResilienceConfig(): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate circuit breaker configurations
  Object.entries(CIRCUIT_BREAKER_CONFIGS).forEach(([name, config]) => {
    if (config.failureThreshold <= 0) {
      errors.push(`Circuit breaker ${name}: failureThreshold must be > 0`);
    }
    
    if (config.successThreshold <= 0) {
      errors.push(`Circuit breaker ${name}: successThreshold must be > 0`);
    }
    
    if (config.timeout <= 0) {
      errors.push(`Circuit breaker ${name}: timeout must be > 0`);
    }
    
    if (config.monitoringWindow <= 0) {
      errors.push(`Circuit breaker ${name}: monitoringWindow must be > 0`);
    }
    
    if (config.volumeThreshold <= 0) {
      errors.push(`Circuit breaker ${name}: volumeThreshold must be > 0`);
    }
    
    if (config.failureThreshold > config.volumeThreshold) {
      warnings.push(`Circuit breaker ${name}: failureThreshold (${config.failureThreshold}) should be <= volumeThreshold (${config.volumeThreshold})`);
    }
  });

  // Validate bulkhead configurations
  Object.entries(BULKHEAD_CONFIGS).forEach(([name, config]) => {
    if (config.maxConcurrentRequests <= 0) {
      errors.push(`Bulkhead ${name}: maxConcurrentRequests must be > 0`);
    }
    
    if (config.maxQueueSize < 0) {
      errors.push(`Bulkhead ${name}: maxQueueSize must be >= 0`);
    }
    
    if (config.queueTimeout <= 0) {
      errors.push(`Bulkhead ${name}: queueTimeout must be > 0`);
    }
    
    if (config.maxConcurrentRequests > 100) {
      warnings.push(`Bulkhead ${name}: maxConcurrentRequests (${config.maxConcurrentRequests}) is very high, consider resource implications`);
    }
    
    if (config.maxQueueSize > 1000) {
      warnings.push(`Bulkhead ${name}: maxQueueSize (${config.maxQueueSize}) is very high, consider memory implications`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Get configuration summary for monitoring/debugging
 */
export function getConfigurationSummary() {
  return {
    environment: process.env.NODE_ENV || 'development',
    globalSettings: RESILIENCE_CONFIG,
    circuitBreakers: Object.fromEntries(
      Object.keys(CIRCUIT_BREAKER_CONFIGS).map(name => [
        name,
        getCircuitBreakerConfig(name as keyof typeof CIRCUIT_BREAKER_CONFIGS)
      ])
    ),
    bulkheads: Object.fromEntries(
      Object.keys(BULKHEAD_CONFIGS).map(name => [
        name,
        getBulkheadConfig(name as keyof typeof BULKHEAD_CONFIGS)
      ])
    ),
    validation: validateResilienceConfig(),
  };
}

// Environment variable documentation for reference
export const ENVIRONMENT_VARIABLES_DOC = {
  'AI_CB_FAILURE_THRESHOLD': 'Number of failures before opening AI generation circuit breaker (default: 5)',
  'AI_CB_SUCCESS_THRESHOLD': 'Number of successes to close AI generation circuit breaker (default: 3)',
  'AI_CB_TIMEOUT': 'Recovery timeout for AI generation circuit breaker in ms (default: 60000)',
  'AI_CB_MONITORING_WINDOW': 'Monitoring window for AI generation circuit breaker in ms (default: 60000)',
  'AI_CB_VOLUME_THRESHOLD': 'Minimum requests before evaluating AI generation circuit breaker (default: 10)',
  
  'AI_BH_MAX_CONCURRENT': 'Maximum concurrent AI generation requests (default: 10)',
  'AI_BH_MAX_QUEUE_SIZE': 'Maximum queue size for AI generation requests (default: 50)',
  'AI_BH_QUEUE_TIMEOUT': 'Queue timeout for AI generation requests in ms (default: 30000)',
  'AI_BH_ENABLE_METRICS': 'Enable metrics collection for AI generation bulkhead (default: true)',
  
  'ENABLE_CIRCUIT_BREAKERS': 'Enable circuit breaker functionality globally (default: true)',
  'ENABLE_BULKHEADS': 'Enable bulkhead functionality globally (default: true)',
  'ENABLE_RESILIENCE_METRICS': 'Enable resilience pattern metrics collection (default: true)',
  'RESILIENCE_DEBUG': 'Enable debug logging for resilience patterns (default: false)',
  'LOG_RESILIENCE_EVENTS': 'Log resilience pattern events (default: true in development)',
  
  // Similar documentation for other providers and services...
};