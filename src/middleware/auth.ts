import { defaultSecurityConfig, type ApiKeyInfo, secureErrorMessages } from '../config/security-config';

export interface AuthResult {
  isAuthenticated: boolean;
  apiKey?: string;
  keyInfo?: ApiKeyInfo;
  error?: string;
}

export class AuthMiddleware {
  constructor(private config = defaultSecurityConfig.auth) {}

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
   * Generate a secure API key
   */
  private generateApiKey(): string {
    // Generate a cryptographically secure random string
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const keyLength = 32;
    let result = '';
    
    // Use crypto.getRandomValues if available, fallback to Math.random for PoC
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const array = new Uint8Array(keyLength);
      crypto.getRandomValues(array);
      for (let i = 0; i < keyLength; i++) {
        result += chars[array[i] % chars.length];
      }
    } else {
      // Fallback for environments without crypto.getRandomValues
      for (let i = 0; i < keyLength; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
      }
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