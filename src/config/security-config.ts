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

export interface RateLimitEntry {
  count: number;
  resetTime: number;
  isAuthenticated: boolean;
}

// Default security configuration
export const defaultSecurityConfig: SecurityConfig = {
  rateLimit: {
    anonymous: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 10, // 10 requests per minute for anonymous users
    },
    authenticated: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 50, // 50 requests per minute for authenticated users
    },
    cleanupIntervalMs: 5 * 60 * 1000, // Clean up old entries every 5 minutes
  },
  validation: {
    maxPromptLength: 500,
    maxBodySizeBytes: 10 * 1024, // 10KB max body size
    allowedContentTypes: ['application/json', 'text/plain'],
  },
  auth: {
    apiKeys: new Map([
      // Default API keys for demo - in production, these should be loaded from secure storage
      ['demo-key-12345', {
        name: 'Demo Basic Key',
        tier: 'basic',
        createdAt: new Date(),
        isActive: true,
      }],
      ['premium-key-67890', {
        name: 'Demo Premium Key',
        tier: 'premium',
        createdAt: new Date(),
        isActive: true,
      }],
    ]),
    headerName: 'authorization',
  },
  security: {
    trustedOrigins: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:19006', // Expo dev server
    ],
    allowCredentials: false,
  },
};

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