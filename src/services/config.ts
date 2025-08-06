// Simplified config system - no singleton, no over-engineering
import { TypeGuards } from '../utils/validation';

// Platform detection
const isReactNative = typeof navigator !== 'undefined' && navigator.product === 'ReactNative';

// Simple config interface
export interface AppConfig {
  version: string;
  environment: 'development' | 'staging' | 'production';
  features: {
    hotReload: boolean;
    aiIntegration: boolean;
    databaseEnabled: boolean;
    remoteComponents: boolean;
  };
  api: {
    baseUrl: string;
    timeout: number;
  };
  componentServer: {
    url: string;
    port: number;
    fallbackToLocal: boolean;
  };
  ai: {
    provider: 'openai' | 'claude' | 'local';
    apiKey?: string;
    maxTokens?: number;
  };
}

// Default configuration
function getDefaultConfig(): AppConfig {
  return {
    version: '1.0.0',
    environment: isReactNative ? 'production' : 'development',
    features: {
      hotReload: !isReactNative,
      aiIntegration: true,
      databaseEnabled: true,
      remoteComponents: false
    },
    api: {
      baseUrl: isReactNative ? 'https://api.example.com' : 'http://localhost:3002',
      timeout: 30000
    },
    componentServer: {
      url: isReactNative ? 'https://components.example.com' : 'http://localhost:3001',
      port: 3001,
      fallbackToLocal: true
    },
    ai: {
      provider: 'local',
      maxTokens: 2000
    }
  };
}

// Simple environment override function
function applyEnvironmentOverrides(config: AppConfig): AppConfig {
  const overridden = { ...config };
  
  if (!isReactNative && process.env.NODE_ENV) {
    overridden.environment = process.env.NODE_ENV as any;
  }
  
  if (!isReactNative && process.env.API_BASE_URL) {
    overridden.api.baseUrl = process.env.API_BASE_URL;
  }
  
  if (!isReactNative && process.env.COMPONENT_SERVER_URL) {
    overridden.componentServer.url = process.env.COMPONENT_SERVER_URL;
  }
  
  return overridden;
}

// Simple validation
function validateConfig(config: AppConfig): boolean {
  try {
    return (
      TypeGuards.isString(config.version) &&
      TypeGuards.isString(config.environment) &&
      TypeGuards.isObject(config.features) &&
      TypeGuards.isObject(config.api) &&
      TypeGuards.isString(config.api.baseUrl) &&
      TypeGuards.isNumber(config.api.timeout)
    );
  } catch {
    return false;
  }
}

// Simple config loader functions (no class needed)
export function loadConfig(): AppConfig {
  try {
    const config = getDefaultConfig();
    const withEnvOverrides = applyEnvironmentOverrides(config);
    
    if (validateConfig(withEnvOverrides)) {
      return withEnvOverrides;
    } else {
      console.warn('Config validation failed, using defaults');
      return getDefaultConfig();
    }
  } catch (error) {
    console.error('Error loading config:', error);
    return getDefaultConfig();
  }
}

// Helper functions for common config access patterns
export function isProduction(config: AppConfig): boolean {
  return config.environment === 'production';
}

export function isDevelopment(config: AppConfig): boolean {
  return config.environment === 'development';
}

export function getFeature(config: AppConfig, feature: keyof AppConfig['features']): boolean {
  return config.features[feature];
}

export function getApiConfig(config: AppConfig): AppConfig['api'] {
  return { ...config.api };
}

export function getAIConfig(config: AppConfig): AppConfig['ai'] {
  return { ...config.ai };
}

// Export default config for immediate use
export const defaultConfig = loadConfig();