import { createHash } from 'crypto';
import { AppSpec } from '../generators/ai-generator';
import { metricsCollector } from '../monitoring/metrics';
import { logger } from '../monitoring/logger';

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
  size: number;
  metadata?: Record<string, any>;
}

export interface CacheConfig {
  maxSize: number; // Maximum cache size in MB
  defaultTTL: number; // Default TTL in milliseconds
  maxEntries: number; // Maximum number of entries
  enableMetrics: boolean;
  enableCompression: boolean;
}

export interface GenerationCacheEntry {
  prompt: string;
  appSpec: AppSpec;
  provider: string;
  model: string;
  timestamp: number;
  generationTime: number;
  promptHash: string;
}

export class GenerationCache {
  private cache = new Map<string, CacheEntry<GenerationCacheEntry>>();
  private config: CacheConfig;
  private cleanupInterval: NodeJS.Timeout;
  private currentSize: number = 0; // Size in bytes

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: 50 * 1024 * 1024, // 50MB default
      defaultTTL: 60 * 60 * 1000, // 1 hour default
      maxEntries: 1000,
      enableMetrics: true,
      enableCompression: false, // Could implement with zlib if needed
      ...config,
    };

    // Start cleanup interval every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);

    logger.info('Generation cache initialized', {
      cache: {
        maxSize: this.config.maxSize,
        defaultTTL: this.config.defaultTTL,
        maxEntries: this.config.maxEntries,
      },
    });
  }

  // Generate cache key from prompt and model info
  private generateKey(prompt: string, provider: string, model: string): string {
    const normalizedPrompt = prompt.trim().toLowerCase();
    const keyData = `${normalizedPrompt}:${provider}:${model}`;
    return createHash('sha256').update(keyData).digest('hex').slice(0, 32);
  }

  // Generate hash for prompt content
  private generatePromptHash(prompt: string): string {
    return createHash('md5').update(prompt.trim().toLowerCase()).digest('hex');
  }

  // Calculate entry size in bytes
  private calculateEntrySize(entry: GenerationCacheEntry): number {
    return (
      Buffer.byteLength(entry.prompt, 'utf8') +
      Buffer.byteLength(JSON.stringify(entry.appSpec), 'utf8') +
      Buffer.byteLength(entry.provider, 'utf8') +
      Buffer.byteLength(entry.model, 'utf8') +
      Buffer.byteLength(entry.promptHash, 'utf8') +
      8 * 3 // timestamps and numbers (8 bytes each)
    );
  }

  // Get cached app spec for a prompt
  get(
    prompt: string,
    provider: string,
    model: string,
    correlationId?: string
  ): AppSpec | null {
    const key = this.generateKey(prompt, provider, model);
    const cacheEntry = this.cache.get(key);

    if (!cacheEntry) {
      if (this.config.enableMetrics) {
        metricsCollector.recordCache({
          key,
          operation: 'miss',
          timestamp: Date.now(),
          correlationId,
        });
      }

      logger.debug('Cache miss for generation request', {
        cache: { key, prompt: prompt.slice(0, 50) },
      }, correlationId);

      return null;
    }

    // Check if entry has expired
    const now = Date.now();
    if (now > cacheEntry.timestamp + cacheEntry.ttl) {
      this.cache.delete(key);
      this.currentSize -= cacheEntry.size;

      if (this.config.enableMetrics) {
        metricsCollector.recordCache({
          key,
          operation: 'evict',
          timestamp: now,
          correlationId,
        });
      }

      logger.debug('Cache entry expired and evicted', {
        cache: { key, age: now - cacheEntry.timestamp },
      }, correlationId);

      return null;
    }

    // Update access statistics
    cacheEntry.accessCount++;
    cacheEntry.lastAccessed = now;

    if (this.config.enableMetrics) {
      metricsCollector.recordCache({
        key,
        operation: 'hit',
        timestamp: now,
        correlationId,
      });
    }

    logger.debug('Cache hit for generation request', {
      cache: {
        key,
        accessCount: cacheEntry.accessCount,
        age: now - cacheEntry.timestamp,
      },
    }, correlationId);

    return cacheEntry.value.appSpec;
  }

  // Cache an app spec
  set(
    prompt: string,
    appSpec: AppSpec,
    provider: string,
    model: string,
    generationTime: number,
    ttl?: number,
    correlationId?: string
  ): void {
    const key = this.generateKey(prompt, provider, model);
    const now = Date.now();
    
    const generationEntry: GenerationCacheEntry = {
      prompt,
      appSpec,
      provider,
      model,
      timestamp: now,
      generationTime,
      promptHash: this.generatePromptHash(prompt),
    };

    const entrySize = this.calculateEntrySize(generationEntry);

    // Check if we need to make space
    if (this.needsEviction(entrySize)) {
      this.evictEntries(entrySize);
    }

    const cacheEntry: CacheEntry<GenerationCacheEntry> = {
      value: generationEntry,
      timestamp: now,
      ttl: ttl || this.config.defaultTTL,
      accessCount: 1,
      lastAccessed: now,
      size: entrySize,
      metadata: {
        provider,
        model,
        generationTime,
      },
    };

    // Remove existing entry if present
    if (this.cache.has(key)) {
      const existing = this.cache.get(key)!;
      this.currentSize -= existing.size;
    }

    this.cache.set(key, cacheEntry);
    this.currentSize += entrySize;

    if (this.config.enableMetrics) {
      metricsCollector.recordCache({
        key,
        operation: 'set',
        timestamp: now,
        correlationId,
      });
    }

    logger.debug('Cached generation result', {
      cache: {
        key,
        size: entrySize,
        totalSize: this.currentSize,
        ttl: cacheEntry.ttl,
        entryCount: this.cache.size,
      },
    }, correlationId);
  }

  // Check if similar prompts exist in cache
  findSimilar(
    prompt: string,
    threshold: number = 0.8
  ): Array<{ entry: GenerationCacheEntry; similarity: number; key: string }> {
    const promptHash = this.generatePromptHash(prompt);
    const results: Array<{ entry: GenerationCacheEntry; similarity: number; key: string }> = [];
    const promptWords = prompt.toLowerCase().split(/\s+/);

    for (const [key, cacheEntry] of this.cache) {
      const cached = cacheEntry.value;
      
      // Skip exact matches (would be handled by get())
      if (cached.promptHash === promptHash) {
        continue;
      }

      // Simple word-based similarity calculation
      const cachedWords = cached.prompt.toLowerCase().split(/\s+/);
      const intersection = promptWords.filter(word => cachedWords.includes(word));
      const union = new Set([...promptWords, ...cachedWords]);
      const similarity = intersection.length / union.size;

      if (similarity >= threshold) {
        results.push({ entry: cached, similarity, key });
      }
    }

    // Sort by similarity (highest first)
    return results.sort((a, b) => b.similarity - a.similarity);
  }

  // Delete a cached entry
  delete(prompt: string, provider: string, model: string): boolean {
    const key = this.generateKey(prompt, provider, model);
    const entry = this.cache.get(key);

    if (entry) {
      this.cache.delete(key);
      this.currentSize -= entry.size;

      logger.debug('Cache entry deleted', { cache: { key } });
      return true;
    }

    return false;
  }

  // Clear all cache entries
  clear(): void {
    const entryCount = this.cache.size;
    this.cache.clear();
    this.currentSize = 0;

    logger.info('Cache cleared', { cache: { clearedEntries: entryCount } });
  }

  // Check if eviction is needed
  private needsEviction(newEntrySize: number): boolean {
    return (
      this.currentSize + newEntrySize > this.config.maxSize ||
      this.cache.size >= this.config.maxEntries
    );
  }

  // Evict entries to make space
  private evictEntries(requiredSpace: number): void {
    const entries = Array.from(this.cache.entries());
    
    // Sort by last accessed (LRU) and access count
    entries.sort((a, b) => {
      // First sort by last accessed time (older first)
      const timeDiff = a[1].lastAccessed - b[1].lastAccessed;
      if (timeDiff !== 0) return timeDiff;
      
      // Then by access count (less accessed first)
      return a[1].accessCount - b[1].accessCount;
    });

    let freedSpace = 0;
    let evictedCount = 0;

    for (const [key, entry] of entries) {
      if (
        freedSpace >= requiredSpace && 
        this.cache.size < this.config.maxEntries &&
        this.currentSize <= this.config.maxSize
      ) {
        break;
      }

      this.cache.delete(key);
      this.currentSize -= entry.size;
      freedSpace += entry.size;
      evictedCount++;

      if (this.config.enableMetrics) {
        metricsCollector.recordCache({
          key,
          operation: 'evict',
          timestamp: Date.now(),
        });
      }
    }

    logger.debug('Cache eviction completed', {
      cache: {
        evictedCount,
        freedSpace,
        remainingEntries: this.cache.size,
        currentSize: this.currentSize,
      },
    });
  }

  // Cleanup expired entries
  private cleanup(): void {
    const now = Date.now();
    let expiredCount = 0;
    let freedSpace = 0;

    for (const [key, entry] of this.cache) {
      if (now > entry.timestamp + entry.ttl) {
        this.cache.delete(key);
        this.currentSize -= entry.size;
        freedSpace += entry.size;
        expiredCount++;

        if (this.config.enableMetrics) {
          metricsCollector.recordCache({
            key,
            operation: 'evict',
            timestamp: now,
          });
        }
      }
    }

    if (expiredCount > 0) {
      logger.debug('Cache cleanup completed', {
        cache: {
          expiredCount,
          freedSpace,
          remainingEntries: this.cache.size,
          currentSize: this.currentSize,
        },
      });
    }
  }

  // Get cache statistics
  getStats(): {
    entries: number;
    size: number;
    maxSize: number;
    utilization: number;
    hitRate?: number;
    missRate?: number;
    oldestEntry?: number;
    newestEntry?: number;
    averageAccessCount: number;
  } {
    const stats = {
      entries: this.cache.size,
      size: this.currentSize,
      maxSize: this.config.maxSize,
      utilization: (this.currentSize / this.config.maxSize) * 100,
      averageAccessCount: 0,
      oldestEntry: undefined as number | undefined,
      newestEntry: undefined as number | undefined,
    };

    if (this.cache.size > 0) {
      const entries = Array.from(this.cache.values());
      
      stats.averageAccessCount = entries.reduce((sum, entry) => sum + entry.accessCount, 0) / entries.length;
      stats.oldestEntry = Math.min(...entries.map(entry => entry.timestamp));
      stats.newestEntry = Math.max(...entries.map(entry => entry.timestamp));
    }

    return stats;
  }

  // Get detailed cache information
  getDetailedStats(): {
    config: CacheConfig;
    stats: ReturnType<typeof this.getStats>;
    entries: Array<{
      key: string;
      prompt: string;
      provider: string;
      model: string;
      timestamp: number;
      accessCount: number;
      lastAccessed: number;
      size: number;
      age: number;
      ttl: number;
    }>;
  } {
    const entries: Array<{
      key: string;
      prompt: string;
      provider: string;
      model: string;
      timestamp: number;
      accessCount: number;
      lastAccessed: number;
      size: number;
      age: number;
      ttl: number;
    }> = [];

    const now = Date.now();

    for (const [key, cacheEntry] of this.cache) {
      entries.push({
        key,
        prompt: cacheEntry.value.prompt.slice(0, 100), // Truncate for display
        provider: cacheEntry.value.provider,
        model: cacheEntry.value.model,
        timestamp: cacheEntry.timestamp,
        accessCount: cacheEntry.accessCount,
        lastAccessed: cacheEntry.lastAccessed,
        size: cacheEntry.size,
        age: now - cacheEntry.timestamp,
        ttl: cacheEntry.ttl,
      });
    }

    // Sort by last accessed (most recent first)
    entries.sort((a, b) => b.lastAccessed - a.lastAccessed);

    return {
      config: this.config,
      stats: this.getStats(),
      entries,
    };
  }

  // Health check
  isHealthy(): boolean {
    try {
      // Check if basic operations work
      const testKey = 'health-check';
      const testPrompt = 'health check test';
      const testAppSpec: AppSpec = {
        appName: 'Health Check App',
        screens: [{ name: 'Test', components: [] }],
      };

      this.set(testPrompt, testAppSpec, 'test', 'test', 100);
      const retrieved = this.get(testPrompt, 'test', 'test');
      this.delete(testPrompt, 'test', 'test');

      return retrieved !== null;
    } catch (error) {
      logger.error('Cache health check failed', error);
      return false;
    }
  }

  // Destroy cache and cleanup
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.clear();
    logger.info('Generation cache destroyed');
  }
}

// Global cache instance
export const generationCache = new GenerationCache({
  maxSize: parseInt(process.env.CACHE_MAX_SIZE || '50') * 1024 * 1024, // Default 50MB
  defaultTTL: parseInt(process.env.CACHE_TTL || '3600') * 1000, // Default 1 hour
  maxEntries: parseInt(process.env.CACHE_MAX_ENTRIES || '1000'), // Default 1000 entries
  enableMetrics: process.env.NODE_ENV !== 'test',
});