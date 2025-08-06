import { defaultSecurityConfig, type ApiKeyInfo, secureErrorMessages } from '../config/security-config';
import { secretsManager } from '../config/secrets';

export interface AuthResult {
  isAuthenticated: boolean;
  apiKey?: string;
  keyInfo?: ApiKeyInfo;
  error?: string;
}

export class AuthMiddleware {
  constructor(private config = defaultSecurityConfig.auth) {
    // Load API keys from environment variables on initialization
    this.loadApiKeysFromEnvironment();
  }
  
  /**
   * Load API keys from environment variables and secrets manager
   */
  private loadApiKeysFromEnvironment(): void {
    try {
      const secrets = secretsManager.getSecrets();
      
      // Load API keys from secrets configuration
      if (secrets.apiKeys.custom) {
        Object.entries(secrets.apiKeys.custom).forEach(([name, key]) => {
          if (key && key.trim()) {
            const keyInfo: ApiKeyInfo = {
              name: `Custom API Key: ${name}`,
              tier: 'basic', // Default tier, could be configured
              createdAt: new Date(),
              isActive: true,
            };
            this.config.apiKeys.set(key, keyInfo);
          }
        });
      }
      
      // For development, you might want to allow specific environment variables
      // for demo keys (but not in production)
      if (process.env.NODE_ENV === 'development') {
        const demoBasicKey = process.env.DEMO_BASIC_API_KEY;
        const demoPremiumKey = process.env.DEMO_PREMIUM_API_KEY;
        
        if (demoBasicKey?.trim()) {
          this.config.apiKeys.set(demoBasicKey, {
            name: 'Demo Basic Key',
            tier: 'basic',
            createdAt: new Date(),
            isActive: true,
          });
        }
        
        if (demoPremiumKey?.trim()) {
          this.config.apiKeys.set(demoPremiumKey, {
            name: 'Demo Premium Key',
            tier: 'premium',
            createdAt: new Date(),
            isActive: true,
          });
        }
      }
    } catch (error) {
      console.warn('Failed to load API keys from environment:', error);
      // Continue with empty key set - keys can be added dynamically
    }
  }

  /**
   * Authenticate a request using API key
   * @param req - The incoming request
   * @returns Authentication result with key info if successful
   */
  authenticate(req: Request): AuthResult {
    const authHeader = req.headers.get(this.config.headerName);
    
    if (!authHeader) {
      return {
        isAuthenticated: false,
        error: 'Missing authorization header',
      };
    }

    // Support both "Bearer <key>" and direct key formats
    const apiKey = this.extractApiKey(authHeader);
    
    if (!apiKey) {
      return {
        isAuthenticated: false,
        error: 'Invalid authorization format',
      };
    }

    const keyInfo = this.config.apiKeys.get(apiKey);
    
    if (!keyInfo) {
      return {
        isAuthenticated: false,
        error: 'Invalid API key',
      };
    }

    if (!keyInfo.isActive) {
      return {
        isAuthenticated: false,
        error: 'API key is inactive',
      };
    }

    // Update last used timestamp
    keyInfo.lastUsed = new Date();
    this.config.apiKeys.set(apiKey, keyInfo);

    return {
      isAuthenticated: true,
      apiKey,
      keyInfo,
    };
  }

  /**
   * Extract API key from authorization header
   * Supports: "Bearer <key>", "ApiKey <key>", or just "<key>"
   */
  private extractApiKey(authHeader: string): string | null {
    const trimmed = authHeader.trim();
    
    // Handle "Bearer <key>" format
    if (trimmed.toLowerCase().startsWith('bearer ')) {
      return trimmed.substring(7).trim();
    }
    
    // Handle "ApiKey <key>" format
    if (trimmed.toLowerCase().startsWith('apikey ')) {
      return trimmed.substring(7).trim();
    }
    
    // Handle direct key format (no prefix)
    if (trimmed.length > 0 && !trimmed.includes(' ')) {
      return trimmed;
    }
    
    return null;
  }

  /**
   * Create an API key (for administrative purposes)
   */
  createApiKey(name: string, tier: 'basic' | 'premium' = 'basic'): string {
    const apiKey = this.generateApiKey();
    const keyInfo: ApiKeyInfo = {
      name,
      tier,
      createdAt: new Date(),
      isActive: true,
    };
    
    this.config.apiKeys.set(apiKey, keyInfo);
    return apiKey;
  }

  /**
   * Deactivate an API key
   */
  deactivateApiKey(apiKey: string): boolean {
    const keyInfo = this.config.apiKeys.get(apiKey);
    if (!keyInfo) return false;
    
    keyInfo.isActive = false;
    this.config.apiKeys.set(apiKey, keyInfo);
    return true;
  }

  /**
   * List all API keys (without exposing the actual keys)
   */
  listApiKeys(): Array<{ name: string; tier: string; createdAt: Date; lastUsed?: Date; isActive: boolean }> {
    return Array.from(this.config.apiKeys.values()).map(keyInfo => ({
      name: keyInfo.name,
      tier: keyInfo.tier,
      createdAt: keyInfo.createdAt,
      lastUsed: keyInfo.lastUsed,
      isActive: keyInfo.isActive,
    }));
  }

  /**
   * Generate a cryptographically secure API key
   * Always uses secure random generation - no fallbacks to weak randomness
   */
  private generateApiKey(): string {
    // Check if crypto.getRandomValues is available
    if (typeof crypto === 'undefined' || !crypto.getRandomValues) {
      throw new Error(
        'Cryptographically secure random number generation is not available. ' +
        'This environment does not support crypto.getRandomValues. ' +
        'Cannot generate secure API keys.'
      );
    }

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const keyLength = 32;
    let result = '';
    
    // Generate cryptographically secure random bytes
    const array = new Uint8Array(keyLength);
    crypto.getRandomValues(array);
    
    // Convert to character string
    for (let i = 0; i < keyLength; i++) {
      result += chars[array[i] % chars.length];
    }
    
    return `ak_${result}`;
  }

  /**
   * Check if an endpoint requires authentication
   */
  requiresAuth(path: string, method: string): boolean {
    // Define which endpoints require authentication
    const protectedEndpoints = [
      { path: '/api/generate', method: 'POST' },
      // Add more protected endpoints as needed
    ];
    
    // For this PoC, only the generate endpoint requires auth for premium features
    // In production, you'd have more sophisticated rules
    return protectedEndpoints.some(endpoint => 
      path === endpoint.path && method === endpoint.method
    );
  }

  /**
   * Check tier-based permissions
   */
  hasPermission(keyInfo: ApiKeyInfo, requiredTier: 'basic' | 'premium'): boolean {
    if (requiredTier === 'basic') return true;
    return keyInfo.tier === 'premium';
  }
}

/**
 * Create an unauthorized response
 */
export function createUnauthorizedResponse(error?: string, headers: Record<string, string> = {}): Response {
  return new Response(
    JSON.stringify({
      error: secureErrorMessages.INVALID_API_KEY,
      code: 'UNAUTHORIZED',
    }),
    {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'WWW-Authenticate': 'Bearer realm="API", charset="UTF-8"',
        ...headers,
      },
    }
  );
}

/**
 * Create a forbidden response for insufficient permissions
 */
export function createForbiddenResponse(headers: Record<string, string> = {}): Response {
  return new Response(
    JSON.stringify({
      error: 'Insufficient permissions for this resource',
      code: 'FORBIDDEN',
    }),
    {
      status: 403,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    }
  );
}

// Create a singleton instance for use across the application
export const authMiddleware = new AuthMiddleware();