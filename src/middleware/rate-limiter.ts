import { defaultSecurityConfig, type RateLimitEntry, secureErrorMessages } from '../config/security-config';

export class RateLimiter {
  private requests = new Map<string, RateLimitEntry>();
  private cleanupInterval: Timer | null = null;
  private locks = new Map<string, Promise<void>>(); // Locks for atomic operations
  
  constructor(private config = defaultSecurityConfig.rateLimit) {
    this.startCleanup();
  }

  /**
   * Check if a request should be rate limited with atomic operations to prevent race conditions
   * @param ip - Client IP address
   * @param isAuthenticated - Whether the request is authenticated
   * @returns Object with isAllowed boolean and remaining requests
   */
  async checkLimit(ip: string, isAuthenticated: boolean = false): Promise<{ 
    isAllowed: boolean; 
    remaining: number; 
    resetTime: number;
    headers: Record<string, string>;
  }> {
    const key = `${ip}:${isAuthenticated ? 'auth' : 'anon'}`;
    
    // Use atomic operation to prevent race conditions
    return await this.atomicOperation(key, () => {
      const now = Date.now();
      const limits = isAuthenticated ? this.config.authenticated : this.config.anonymous;
      
      let entry = this.requests.get(key);
      
      // If no entry exists or the window has expired, create a new one
      if (!entry || now >= entry.resetTime) {
        entry = {
          count: 0,
          resetTime: now + limits.windowMs,
          isAuthenticated,
        };
      }
      
      // Increment the request count atomically
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
    });
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
  async clearLimit(ip: string, isAuthenticated?: boolean): Promise<void> {
    if (isAuthenticated !== undefined) {
      const key = `${ip}:${isAuthenticated ? 'auth' : 'anon'}`;
      await this.atomicOperation(key, () => {
        this.requests.delete(key);
      });
    } else {
      // Clear both authenticated and anonymous entries for this IP
      const authKey = `${ip}:auth`;
      const anonKey = `${ip}:anon`;
      
      await Promise.all([
        this.atomicOperation(authKey, () => {
          this.requests.delete(authKey);
        }),
        this.atomicOperation(anonKey, () => {
          this.requests.delete(anonKey);
        })
      ]);
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
   * Perform an atomic operation for a specific key to prevent race conditions
   */
  private async atomicOperation<T>(key: string, operation: () => T): Promise<T> {
    // Wait for any existing lock on this key
    const existingLock = this.locks.get(key);
    if (existingLock) {
      await existingLock;
    }
    
    // Create a new lock for this operation
    let resolve: () => void;
    const lock = new Promise<void>((res) => {
      resolve = res;
    });
    
    this.locks.set(key, lock);
    
    try {
      // Execute the operation
      const result = operation();
      return result;
    } finally {
      // Release the lock
      this.locks.delete(key);
      resolve!();
    }
  }

  /**
   * Increment request counter atomically
   */
  private async incrementCounter(key: string, isAuthenticated: boolean): Promise<{
    count: number;
    resetTime: number;
    isAllowed: boolean;
    remaining: number;
  }> {
    return await this.atomicOperation(key, () => {
      const now = Date.now();
      const limits = isAuthenticated ? this.config.authenticated : this.config.anonymous;
      
      let entry = this.requests.get(key);
      
      // If no entry exists or the window has expired, create a new one
      if (!entry || now >= entry.resetTime) {
        entry = {
          count: 0,
          resetTime: now + limits.windowMs,
          isAuthenticated,
        };
      }
      
      // Atomic increment
      entry.count++;
      this.requests.set(key, entry);
      
      const isAllowed = entry.count <= limits.maxRequests;
      const remaining = Math.max(0, limits.maxRequests - entry.count);
      
      return {
        count: entry.count,
        resetTime: entry.resetTime,
        isAllowed,
        remaining,
      };
    });
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
    this.locks.clear();
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
 * Extract client IP from request with proper proxy validation
 * Only trusts proxy headers when the request comes from a known trusted proxy
 */
export function getClientIP(req: Request, trustedProxies: string[] = []): string {
  // For security, we need to validate that proxy headers are only trusted
  // when the request actually comes from a known proxy
  
  // In a real environment, you'd get the actual connection IP from the server
  // For this implementation, we'll simulate this with careful header validation
  const remoteAddress = getRemoteAddress(req);
  
  // Only trust proxy headers if the request comes from a trusted proxy
  if (trustedProxies.length > 0 && isTrustedProxy(remoteAddress, trustedProxies)) {
    // Process proxy headers in order of trust
    const forwardedFor = req.headers.get('X-Forwarded-For');
    const realIP = req.headers.get('X-Real-IP');
    const connectingIP = req.headers.get('CF-Connecting-IP'); // Cloudflare
    
    // X-Forwarded-For can contain a chain of IPs: "client, proxy1, proxy2"
    if (forwardedFor) {
      const ips = forwardedFor.split(',').map(ip => ip.trim());
      const clientIP = ips[0]; // First IP should be the original client
      
      if (isValidIPAddress(clientIP)) {
        return clientIP;
      }
    }
    
    // Fallback to other proxy headers
    if (realIP && isValidIPAddress(realIP)) {
      return realIP;
    }
    
    if (connectingIP && isValidIPAddress(connectingIP)) {
      return connectingIP;
    }
  }
  
  // If no trusted proxy or no valid proxy headers, use the remote address
  return remoteAddress;
}

/**
 * Get the remote address of the connection
 * In a real server environment, this would come from the socket
 */
function getRemoteAddress(req: Request): string {
  // In a production environment with a real server (like Node.js HTTP server),
  // you would get this from req.socket.remoteAddress or similar
  // For this implementation, we'll use connection info if available
  
  // Check for common server-provided headers that indicate the actual connection IP
  const connectionIP = req.headers.get('X-Connection-IP');
  if (connectionIP && isValidIPAddress(connectionIP)) {
    return connectionIP;
  }
  
  // Fallback for development/testing
  return '127.0.0.1';
}

/**
 * Check if an IP address is in the trusted proxy list
 */
function isTrustedProxy(ip: string, trustedProxies: string[]): boolean {
  for (const trustedProxy of trustedProxies) {
    if (trustedProxy === ip) {
      return true;
    }
    
    // Check CIDR ranges
    if (trustedProxy.includes('/')) {
      if (isIPInCIDR(ip, trustedProxy)) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Validate if a string is a valid IP address
 */
function isValidIPAddress(ip: string): boolean {
  // IPv4 validation
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Regex.test(ip)) {
    const parts = ip.split('.');
    return parts.every(part => {
      const num = parseInt(part, 10);
      return num >= 0 && num <= 255;
    });
  }
  
  // IPv6 basic validation (simplified)
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$/;
  return ipv6Regex.test(ip);
}

/**
 * Check if an IP is within a CIDR range
 * This is a simplified implementation - in production, use a proper IP library
 */
function isIPInCIDR(ip: string, cidr: string): boolean {
  const [network, prefixLength] = cidr.split('/');
  const prefix = parseInt(prefixLength, 10);
  
  if (!isValidIPAddress(ip) || !isValidIPAddress(network)) {
    return false;
  }
  
  // For IPv4 only (simplified implementation)
  if (ip.includes('.') && network.includes('.')) {
    const ipNum = ipToNumber(ip);
    const networkNum = ipToNumber(network);
    const mask = -1 << (32 - prefix);
    
    return (ipNum & mask) === (networkNum & mask);
  }
  
  return false;
}

/**
 * Convert IPv4 address to number for CIDR calculations
 */
function ipToNumber(ip: string): number {
  const parts = ip.split('.');
  return (
    (parseInt(parts[0], 10) << 24) +
    (parseInt(parts[1], 10) << 16) +
    (parseInt(parts[2], 10) << 8) +
    parseInt(parts[3], 10)
  ) >>> 0; // Unsigned right shift to handle negative numbers
}

// Create a singleton instance for use across the application
export const rateLimiter = new RateLimiter();