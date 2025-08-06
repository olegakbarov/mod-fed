import { defaultSecurityConfig, type RateLimitEntry, secureErrorMessages } from '../config/security-config';

export class RateLimiter {
  private requests = new Map<string, RateLimitEntry>();
  private cleanupInterval: Timer | null = null;
  
  constructor(private config = defaultSecurityConfig.rateLimit) {
    this.startCleanup();
  }

  /**
   * Check if a request should be rate limited
   * @param ip - Client IP address
   * @param isAuthenticated - Whether the request is authenticated
   * @returns Object with isAllowed boolean and remaining requests
   */
  checkLimit(ip: string, isAuthenticated: boolean = false): { 
    isAllowed: boolean; 
    remaining: number; 
    resetTime: number;
    headers: Record<string, string>;
  } {
    const now = Date.now();
    const limits = isAuthenticated ? this.config.authenticated : this.config.anonymous;
    const key = `${ip}:${isAuthenticated ? 'auth' : 'anon'}`;
    
    let entry = this.requests.get(key);
    
    // If no entry exists or the window has expired, create a new one
    if (!entry || now >= entry.resetTime) {
      entry = {
        count: 0,
        resetTime: now + limits.windowMs,
        isAuthenticated,
      };
    }
    
    // Increment the request count
    entry.count++;
    this.requests.set(key, entry);
    
    const isAllowed = entry.count <= limits.maxRequests;
    const remaining = Math.max(0, limits.maxRequests - entry.count);
    
    // Rate limit headers for client information
    const headers = {
      'X-RateLimit-Limit': limits.maxRequests.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': Math.ceil(entry.resetTime / 1000).toString(),
      'X-RateLimit-Window': Math.ceil(limits.windowMs / 1000).toString(),
    };
    
    return {
      isAllowed,
      remaining,
      resetTime: entry.resetTime,
      headers,
    };
  }

  /**
   * Get current usage stats for monitoring
   */
  getStats(): {
    totalEntries: number;
    activeIPs: number;
    authenticatedRequests: number;
    anonymousRequests: number;
  } {
    const now = Date.now();
    let activeIPs = 0;
    let authenticatedRequests = 0;
    let anonymousRequests = 0;

    for (const [key, entry] of this.requests.entries()) {
      if (now < entry.resetTime) {
        activeIPs++;
        if (entry.isAuthenticated) {
          authenticatedRequests += entry.count;
        } else {
          anonymousRequests += entry.count;
        }
      }
    }

    return {
      totalEntries: this.requests.size,
      activeIPs,
      authenticatedRequests,
      anonymousRequests,
    };
  }

  /**
   * Manually clear rate limit for an IP (useful for testing or admin overrides)
   */
  clearLimit(ip: string, isAuthenticated?: boolean): void {
    if (isAuthenticated !== undefined) {
      const key = `${ip}:${isAuthenticated ? 'auth' : 'anon'}`;
      this.requests.delete(key);
    } else {
      // Clear both authenticated and anonymous entries for this IP
      this.requests.delete(`${ip}:auth`);
      this.requests.delete(`${ip}:anon`);
    }
  }

  /**
   * Start the cleanup interval to remove expired entries
   */
  private startCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupIntervalMs);
  }

  /**
   * Remove expired rate limit entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.requests.entries()) {
      if (now >= entry.resetTime) {
        this.requests.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`Rate limiter cleaned up ${cleaned} expired entries. Active entries: ${this.requests.size}`);
    }
  }

  /**
   * Stop the cleanup interval (useful for testing or shutdown)
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.requests.clear();
  }
}

/**
 * Create a rate limit response
 */
export function createRateLimitResponse(headers: Record<string, string>): Response {
  return new Response(
    JSON.stringify({
      error: secureErrorMessages.RATE_LIMIT_EXCEEDED,
      code: 'RATE_LIMIT_EXCEEDED',
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    }
  );
}

/**
 * Extract client IP from request
 */
export function getClientIP(req: Request): string {
  // In a real production environment, you'd want to properly handle proxy headers
  // like X-Forwarded-For, X-Real-IP, etc. For this PoC, we'll use a simple approach
  const forwardedFor = req.headers.get('X-Forwarded-For');
  const realIP = req.headers.get('X-Real-IP');
  const connectingIP = req.headers.get('CF-Connecting-IP'); // Cloudflare
  
  // Parse the first IP from X-Forwarded-For if present
  if (forwardedFor) {
    const ips = forwardedFor.split(',').map(ip => ip.trim());
    return ips[0];
  }
  
  if (realIP) return realIP;
  if (connectingIP) return connectingIP;
  
  // Fallback for local development - in production you'd get this from the socket
  return '127.0.0.1';
}

// Create a singleton instance for use across the application
export const rateLimiter = new RateLimiter();