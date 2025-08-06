export interface MetricEvent {
  name: string;
  value: number;
  timestamp: number;
  labels?: Record<string, string>;
  correlationId?: string;
}

export interface RequestMetric {
  method: string;
  path: string;
  statusCode: number;
  responseTime: number;
  timestamp: number;
  clientIP: string;
  userAgent?: string;
  correlationId: string;
  error?: string;
}

export interface GenerationMetric {
  prompt: string;
  success: boolean;
  responseTime: number;
  timestamp: number;
  provider: string;
  model: string;
  fallbackUsed: boolean;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
  };
  correlationId: string;
  error?: string;
}

export interface CacheMetric {
  key: string;
  operation: 'hit' | 'miss' | 'set' | 'evict';
  timestamp: number;
  correlationId?: string;
}

export interface SystemMetric {
  cpuUsage?: number;
  memoryUsage?: {
    used: number;
    total: number;
    percentage: number;
  };
  activeConnections: number;
  timestamp: number;
}

export class MetricsCollector {
  private metrics: MetricEvent[] = [];
  private requestMetrics: RequestMetric[] = [];
  private generationMetrics: GenerationMetric[] = [];
  private cacheMetrics: CacheMetric[] = [];
  private systemMetrics: SystemMetric[] = [];
  
  private readonly maxMetricsHistory = 10000;
  private readonly metricsRetentionMs = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    // Start periodic cleanup
    this.startCleanup();
    
    // Start system metrics collection
    this.startSystemMetricsCollection();
  }

  // Generic metric recording
  recordMetric(metric: MetricEvent): void {
    this.metrics.push(metric);
    this.cleanup();
  }

  // Request-specific metrics
  recordRequest(metric: RequestMetric): void {
    this.requestMetrics.push(metric);
    this.recordMetric({
      name: 'http_request_duration',
      value: metric.responseTime,
      timestamp: metric.timestamp,
      labels: {
        method: metric.method,
        path: metric.path,
        status: metric.statusCode.toString(),
      },
      correlationId: metric.correlationId,
    });
    
    this.cleanup();
  }

  // AI generation metrics
  recordGeneration(metric: GenerationMetric): void {
    this.generationMetrics.push(metric);
    
    this.recordMetric({
      name: 'ai_generation_duration',
      value: metric.responseTime,
      timestamp: metric.timestamp,
      labels: {
        provider: metric.provider,
        model: metric.model,
        success: metric.success.toString(),
        fallback: metric.fallbackUsed.toString(),
      },
      correlationId: metric.correlationId,
    });

    if (metric.tokenUsage) {
      this.recordMetric({
        name: 'ai_token_usage',
        value: metric.tokenUsage.promptTokens + metric.tokenUsage.completionTokens,
        timestamp: metric.timestamp,
        labels: {
          type: 'total',
          provider: metric.provider,
          model: metric.model,
        },
        correlationId: metric.correlationId,
      });
    }

    this.cleanup();
  }

  // Cache metrics
  recordCache(metric: CacheMetric): void {
    this.cacheMetrics.push(metric);
    
    this.recordMetric({
      name: 'cache_operation',
      value: 1,
      timestamp: metric.timestamp,
      labels: {
        operation: metric.operation,
      },
      correlationId: metric.correlationId,
    });

    this.cleanup();
  }

  // System metrics
  recordSystem(metric: SystemMetric): void {
    this.systemMetrics.push(metric);
    
    if (metric.cpuUsage !== undefined) {
      this.recordMetric({
        name: 'system_cpu_usage',
        value: metric.cpuUsage,
        timestamp: metric.timestamp,
      });
    }

    if (metric.memoryUsage) {
      this.recordMetric({
        name: 'system_memory_usage',
        value: metric.memoryUsage.percentage,
        timestamp: metric.timestamp,
        labels: {
          type: 'percentage',
        },
      });
    }

    this.recordMetric({
      name: 'system_active_connections',
      value: metric.activeConnections,
      timestamp: metric.timestamp,
    });
  }

  // Aggregated statistics
  getRequestStats(timeRangeMs: number = 60 * 60 * 1000): {
    totalRequests: number;
    successRate: number;
    averageResponseTime: number;
    errorRate: number;
    requestsPerMinute: number;
    statusCodeDistribution: Record<string, number>;
    topEndpoints: Array<{ path: string; count: number }>;
  } {
    const cutoff = Date.now() - timeRangeMs;
    const recentRequests = this.requestMetrics.filter(m => m.timestamp >= cutoff);

    const totalRequests = recentRequests.length;
    const successfulRequests = recentRequests.filter(m => m.statusCode < 400).length;
    const averageResponseTime = recentRequests.length > 0 
      ? recentRequests.reduce((sum, m) => sum + m.responseTime, 0) / recentRequests.length 
      : 0;

    // Status code distribution
    const statusCodeDistribution = recentRequests.reduce((acc, m) => {
      const statusRange = `${Math.floor(m.statusCode / 100)}xx`;
      acc[statusRange] = (acc[statusRange] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Top endpoints
    const endpointCounts = recentRequests.reduce((acc, m) => {
      acc[m.path] = (acc[m.path] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topEndpoints = Object.entries(endpointCounts)
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalRequests,
      successRate: totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0,
      errorRate: totalRequests > 0 ? ((totalRequests - successfulRequests) / totalRequests) * 100 : 0,
      averageResponseTime,
      requestsPerMinute: (totalRequests / (timeRangeMs / 60000)),
      statusCodeDistribution,
      topEndpoints,
    };
  }

  getGenerationStats(timeRangeMs: number = 60 * 60 * 1000): {
    totalGenerations: number;
    successRate: number;
    averageResponseTime: number;
    fallbackRate: number;
    providerDistribution: Record<string, number>;
    averageTokenUsage: number;
    errorsCount: number;
  } {
    const cutoff = Date.now() - timeRangeMs;
    const recentGenerations = this.generationMetrics.filter(m => m.timestamp >= cutoff);

    const totalGenerations = recentGenerations.length;
    const successfulGenerations = recentGenerations.filter(m => m.success).length;
    const fallbackGenerations = recentGenerations.filter(m => m.fallbackUsed).length;
    const errorsCount = recentGenerations.filter(m => m.error).length;

    const averageResponseTime = recentGenerations.length > 0
      ? recentGenerations.reduce((sum, m) => sum + m.responseTime, 0) / recentGenerations.length
      : 0;

    const providerDistribution = recentGenerations.reduce((acc, m) => {
      acc[m.provider] = (acc[m.provider] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const tokenUsages = recentGenerations
      .filter(m => m.tokenUsage)
      .map(m => m.tokenUsage!.promptTokens + m.tokenUsage!.completionTokens);
    const averageTokenUsage = tokenUsages.length > 0
      ? tokenUsages.reduce((sum, tokens) => sum + tokens, 0) / tokenUsages.length
      : 0;

    return {
      totalGenerations,
      successRate: totalGenerations > 0 ? (successfulGenerations / totalGenerations) * 100 : 0,
      averageResponseTime,
      fallbackRate: totalGenerations > 0 ? (fallbackGenerations / totalGenerations) * 100 : 0,
      providerDistribution,
      averageTokenUsage,
      errorsCount,
    };
  }

  getCacheStats(timeRangeMs: number = 60 * 60 * 1000): {
    totalOperations: number;
    hitRate: number;
    missRate: number;
    operationDistribution: Record<string, number>;
  } {
    const cutoff = Date.now() - timeRangeMs;
    const recentCacheOps = this.cacheMetrics.filter(m => m.timestamp >= cutoff);

    const totalOperations = recentCacheOps.length;
    const hits = recentCacheOps.filter(m => m.operation === 'hit').length;
    const misses = recentCacheOps.filter(m => m.operation === 'miss').length;

    const operationDistribution = recentCacheOps.reduce((acc, m) => {
      acc[m.operation] = (acc[m.operation] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const totalLookups = hits + misses;

    return {
      totalOperations,
      hitRate: totalLookups > 0 ? (hits / totalLookups) * 100 : 0,
      missRate: totalLookups > 0 ? (misses / totalLookups) * 100 : 0,
      operationDistribution,
    };
  }

  getSystemStats(): SystemMetric | null {
    const latest = this.systemMetrics[this.systemMetrics.length - 1];
    return latest || null;
  }

  // Get metrics in Prometheus-compatible format
  getPrometheusMetrics(): string {
    const lines: string[] = [];

    // Request metrics
    const requestStats = this.getRequestStats();
    lines.push(`# HELP http_requests_total The total number of HTTP requests`);
    lines.push(`# TYPE http_requests_total counter`);
    lines.push(`http_requests_total ${requestStats.totalRequests}`);

    lines.push(`# HELP http_request_duration_seconds The HTTP request latency`);
    lines.push(`# TYPE http_request_duration_seconds histogram`);
    lines.push(`http_request_duration_seconds_sum ${requestStats.averageResponseTime * requestStats.totalRequests / 1000}`);
    lines.push(`http_request_duration_seconds_count ${requestStats.totalRequests}`);

    // Generation metrics
    const genStats = this.getGenerationStats();
    lines.push(`# HELP ai_generations_total The total number of AI generations`);
    lines.push(`# TYPE ai_generations_total counter`);
    lines.push(`ai_generations_total ${genStats.totalGenerations}`);

    lines.push(`# HELP ai_generation_success_rate The success rate of AI generations`);
    lines.push(`# TYPE ai_generation_success_rate gauge`);
    lines.push(`ai_generation_success_rate ${genStats.successRate / 100}`);

    // Cache metrics
    const cacheStats = this.getCacheStats();
    lines.push(`# HELP cache_operations_total The total number of cache operations`);
    lines.push(`# TYPE cache_operations_total counter`);
    lines.push(`cache_operations_total ${cacheStats.totalOperations}`);

    lines.push(`# HELP cache_hit_rate The cache hit rate`);
    lines.push(`# TYPE cache_hit_rate gauge`);
    lines.push(`cache_hit_rate ${cacheStats.hitRate / 100}`);

    return lines.join('\n') + '\n';
  }

  // Get detailed metrics for monitoring dashboard
  getDetailedMetrics() {
    return {
      requests: this.getRequestStats(),
      generations: this.getGenerationStats(),
      cache: this.getCacheStats(),
      system: this.getSystemStats(),
      timestamp: Date.now(),
    };
  }

  private cleanup(): void {
    const cutoff = Date.now() - this.metricsRetentionMs;

    // Clean up general metrics
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.maxMetricsHistory);
    }
    this.metrics = this.metrics.filter(m => m.timestamp >= cutoff);

    // Clean up specific metric types
    this.requestMetrics = this.requestMetrics.filter(m => m.timestamp >= cutoff);
    this.generationMetrics = this.generationMetrics.filter(m => m.timestamp >= cutoff);
    this.cacheMetrics = this.cacheMetrics.filter(m => m.timestamp >= cutoff);
    this.systemMetrics = this.systemMetrics.filter(m => m.timestamp >= cutoff);
  }

  private startCleanup(): void {
    // Run cleanup every 5 minutes
    setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  private startSystemMetricsCollection(): void {
    // Collect system metrics every 30 seconds
    setInterval(() => {
      try {
        const memoryUsage = process.memoryUsage();
        
        this.recordSystem({
          memoryUsage: {
            used: memoryUsage.heapUsed,
            total: memoryUsage.heapTotal,
            percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
          },
          activeConnections: 0, // Would need to track this from server
          timestamp: Date.now(),
        });
      } catch (error) {
        console.error('Failed to collect system metrics:', error);
      }
    }, 30 * 1000);
  }

  // Health check method
  isHealthy(): boolean {
    const recentRequests = this.requestMetrics.filter(m => 
      m.timestamp >= Date.now() - 5 * 60 * 1000 // last 5 minutes
    );

    // Consider unhealthy if error rate is above 50% in recent requests
    if (recentRequests.length > 10) {
      const errorRate = recentRequests.filter(m => m.statusCode >= 500).length / recentRequests.length;
      if (errorRate > 0.5) {
        return false;
      }
    }

    // Check if system metrics are being collected
    const recentSystemMetrics = this.systemMetrics.filter(m => 
      m.timestamp >= Date.now() - 2 * 60 * 1000 // last 2 minutes
    );

    return recentSystemMetrics.length > 0;
  }
}

// Global metrics collector instance
export const metricsCollector = new MetricsCollector();