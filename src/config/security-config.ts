export interface SecurityConfig {
  rateLimit: {
    anonymous: {
      windowMs: number;
      maxRequests: number;
    };
    authenticated: {
      windowMs: number;
      maxRequests: number;
    };
    cleanupIntervalMs: number;
  };
  validation: {
    maxPromptLength: number;
    maxBodySizeBytes: number;
    allowedContentTypes: string[];
  };
  auth: {
    apiKeys: Map<string, ApiKeyInfo>;
    headerName: string;
  };
  security: {
    trustedOrigins: string[];
    trustedProxies: string[];
    allowCredentials: boolean;
  };
}

export interface ApiKeyInfo {
  name: string;
  tier: 'basic' | 'premium';
  createdAt: Date;
  lastUsed?: Date;
  isActive: boolean;
}

import { secretsManager } from './secrets';

export interface RateLimitEntry {
  count: number;
  resetTime: number;
  isAuthenticated: boolean;
}

/**
 * Initialize security configuration from environment variables
 * This function is called at application startup
 */
export function initializeSecurityConfig(): SecurityConfig {
  try {
    const secrets = secretsManager.initialize();
    
    return {
      rateLimit: {
        anonymous: {
          windowMs: 60 * 1000, // 1 minute
          maxRequests: parseInt(process.env.RATE_LIMIT_ANONYMOUS_MAX || '10', 10),
        },
        authenticated: {
          windowMs: 60 * 1000, // 1 minute
          maxRequests: parseInt(process.env.RATE_LIMIT_AUTH_MAX || '50', 10),
        },
        cleanupIntervalMs: 5 * 60 * 1000, // Clean up old entries every 5 minutes
      },
      validation: {
        maxPromptLength: parseInt(process.env.MAX_PROMPT_LENGTH || '500', 10),
        maxBodySizeBytes: parseInt(process.env.MAX_BODY_SIZE_BYTES || '10240', 10), // 10KB default
        allowedContentTypes: ['application/json', 'text/plain'],
      },
      auth: {
        // API keys are now loaded dynamically through the auth middleware
        // This map will be populated at runtime from secure storage
        apiKeys: new Map(),
        headerName: 'authorization',
      },
      security: {
        trustedOrigins: secrets.security.corsOrigins.length > 0 
          ? secrets.security.corsOrigins 
          : [
              'http://localhost:3000',
              'http://localhost:3001',
              'http://localhost:19006', // Expo dev server
            ],
        trustedProxies: secrets.security.trustedProxies.length > 0
          ? secrets.security.trustedProxies
          : ['127.0.0.1', '::1'], // Default to localhost only
        allowCredentials: false,
      },
    };
  } catch (error) {
    // Log the safe error message
    const safeMessage = secretsManager.createSafeErrorMessage(error as Error);
    console.error('Failed to initialize security config:', safeMessage);
    
    // In production, you might want to fail fast here
    // For now, we'll return a minimal safe configuration
    return createFallbackSecurityConfig();
  }
}

/**
 * Create a fallback security configuration when initialization fails
 * This ensures the application can still start in development environments
 */
function createFallbackSecurityConfig(): SecurityConfig {
  console.warn('Using fallback security configuration - this should not happen in production!');
  
  return {
    rateLimit: {
      anonymous: {
        windowMs: 60 * 1000,
        maxRequests: 5, // More restrictive when using fallback
      },
      authenticated: {
        windowMs: 60 * 1000,
        maxRequests: 20, // More restrictive when using fallback
      },
      cleanupIntervalMs: 5 * 60 * 1000,
    },
    validation: {
      maxPromptLength: 200, // More restrictive
      maxBodySizeBytes: 5 * 1024, // More restrictive (5KB)
      allowedContentTypes: ['application/json'],
    },
    auth: {
      apiKeys: new Map(), // No default keys in fallback
      headerName: 'authorization',
    },
    security: {
      trustedOrigins: ['http://localhost:3000'], // Minimal trusted origins
      trustedProxies: ['127.0.0.1'], // Only localhost
      allowCredentials: false,
    },
  };
}

// Default security configuration - will be initialized at runtime
export let defaultSecurityConfig: SecurityConfig = createFallbackSecurityConfig();

// Security headers configuration
export const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';",
};

// Error messages that don't leak sensitive information
export const secureErrorMessages = {
  RATE_LIMIT_EXCEEDED: 'Too many requests. Please try again later.',
  INVALID_API_KEY: 'Invalid or missing API key.',
  VALIDATION_ERROR: 'Request validation failed.',
  INTERNAL_ERROR: 'An internal error occurred.',
  NOT_FOUND: 'Resource not found.',
  METHOD_NOT_ALLOWED: 'Method not allowed.',
  UNAUTHORIZED: 'Authentication required.',
} as const;

export type SecureErrorMessage = typeof secureErrorMessages[keyof typeof secureErrorMessages];