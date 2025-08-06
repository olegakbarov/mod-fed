import { Database } from "bun:sqlite";
import { logger } from "../monitoring/logger";
import { DatabaseConnectionError, DatabaseError } from "../errors/ai-errors";

export interface PooledConnection {
  db: Database;
  id: string;
  isActive: boolean;
  lastUsed: number;
  created: number;
  queryCount: number;
}

export interface ConnectionPoolOptions {
  minConnections: number;
  maxConnections: number;
  connectionTimeout: number;
  idleTimeout: number;
  healthCheckInterval: number;
  maxConnectionAge: number;
  maxQueriesPerConnection: number;
}

export interface PoolStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingRequests: number;
  totalQueries: number;
  averageResponseTime: number;
  healthyConnections: number;
  recycledConnections: number;
}

export class ConnectionPool {
  private connections: Map<string, PooledConnection> = new Map();
  private waitingQueue: Array<{
    resolve: (connection: PooledConnection) => void;
    reject: (error: Error) => void;
    timestamp: number;
  }> = [];
  private healthCheckTimer: Timer | null = null;
  private totalQueries = 0;
  private totalResponseTime = 0;
  private recycledConnections = 0;
  private isShutdown = false;

  constructor(
    private dbPath: string,
    private options: ConnectionPoolOptions = {
      minConnections: 2,
      maxConnections: 10,
      connectionTimeout: 5000,
      idleTimeout: 300000, // 5 minutes
      healthCheckInterval: 60000, // 1 minute
      maxConnectionAge: 3600000, // 1 hour
      maxQueriesPerConnection: 1000,
    }
  ) {
    this.initialize();
  }

  /**
   * Initialize the connection pool
   */
  private async initialize(): Promise<void> {
    try {
      // Create minimum number of connections
      for (let i = 0; i < this.options.minConnections; i++) {
        await this.createConnection();
      }

      // Start health check interval
      this.startHealthCheck();

      logger.info('Database connection pool initialized', {
        database: {
          pool: {
            minConnections: this.options.minConnections,
            maxConnections: this.options.maxConnections,
            initialConnections: this.connections.size,
          }
        }
      });
    } catch (error) {
      logger.error('Failed to initialize connection pool', error as Error, {
        database: { operation: 'pool_initialization' }
      });
      throw new DatabaseConnectionError(
        'Failed to initialize connection pool',
        'pool_initialization',
        undefined,
        false,
        error as Error
      );
    }
  }

  /**
   * Get a connection from the pool
   */
  async getConnection(): Promise<PooledConnection> {
    if (this.isShutdown) {
      throw new DatabaseConnectionError(
        'Connection pool is shutdown',
        'pool_shutdown'
      );
    }

    // Try to find an available connection
    const availableConnection = this.findAvailableConnection();
    if (availableConnection) {
      availableConnection.isActive = true;
      availableConnection.lastUsed = Date.now();
      return availableConnection;
    }

    // If we can create more connections, do so
    if (this.connections.size < this.options.maxConnections) {
      try {
        const newConnection = await this.createConnection();
        newConnection.isActive = true;
        return newConnection;
      } catch (error) {
        logger.error('Failed to create new connection', error as Error, {
          database: { operation: 'create_connection' }
        });
      }
    }

    // Wait for a connection to become available
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        // Remove from queue
        const index = this.waitingQueue.findIndex(item => item.resolve === resolve);
        if (index !== -1) {
          this.waitingQueue.splice(index, 1);
        }
        reject(new DatabaseConnectionError(
          'Connection timeout - no available connections',
          'connection_timeout'
        ));
      }, this.options.connectionTimeout);

      this.waitingQueue.push({
        resolve: (connection) => {
          clearTimeout(timeout);
          resolve(connection);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
        timestamp: Date.now(),
      });
    });
  }

  /**
   * Release a connection back to the pool
   */
  releaseConnection(connection: PooledConnection): void {
    if (!connection || !this.connections.has(connection.id)) {
      logger.warn('Attempted to release unknown connection', undefined, {
        database: { connectionId: connection?.id }
      });
      return;
    }

    connection.isActive = false;
    connection.lastUsed = Date.now();
    connection.queryCount++;

    // Check if connection needs to be recycled
    if (this.shouldRecycleConnection(connection)) {
      this.recycleConnection(connection);
      return;
    }

    // If there are waiting requests, give the connection to the next in queue
    if (this.waitingQueue.length > 0) {
      const waiting = this.waitingQueue.shift()!;
      connection.isActive = true;
      waiting.resolve(connection);
      return;
    }

    // Connection goes back to idle state
    logger.debug('Connection released to pool', {
      database: { 
        connectionId: connection.id,
        queryCount: connection.queryCount,
        age: Date.now() - connection.created
      }
    });
  }

  /**
   * Execute a query with automatic connection management
   */
  async query<T = any>(
    sql: string, 
    params: any[] = [], 
    operation: 'get' | 'all' | 'run' = 'all'
  ): Promise<T> {
    const startTime = Date.now();
    let connection: PooledConnection | null = null;

    try {
      connection = await this.getConnection();
      
      const stmt = connection.db.prepare(sql);
      let result: T;

      switch (operation) {
        case 'get':
          result = params.length > 0 ? stmt.get(...params) as T : stmt.get() as T;
          break;
        case 'all':
          result = params.length > 0 ? stmt.all(...params) as T : stmt.all() as T;
          break;
        case 'run':
          result = params.length > 0 ? stmt.run(...params) as T : stmt.run() as T;
          break;
        default:
          throw new DatabaseError('Invalid operation type', operation, undefined, false);
      }

      // Record query metrics
      const responseTime = Date.now() - startTime;
      this.recordQueryMetrics(responseTime);

      return result;
    } catch (error) {
      logger.error('Database query failed', error as Error, {
        database: { 
          sql: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
          operation,
          connectionId: connection?.id
        }
      });
      throw new DatabaseError(
        `Query failed: ${(error as Error).message}`,
        operation,
        sql.split(' ')[0],
        true,
        undefined,
        error as Error
      );
    } finally {
      if (connection) {
        this.releaseConnection(connection);
      }
    }
  }

  /**
   * Execute multiple queries in a transaction
   */
  async transaction<T>(callback: (db: Database) => T): Promise<T> {
    let connection: PooledConnection | null = null;

    try {
      connection = await this.getConnection();
      
      // Start transaction
      connection.db.run('BEGIN TRANSACTION');

      try {
        const result = callback(connection.db);
        
        // If result is a promise, wait for it
        const finalResult = result instanceof Promise ? await result : result;
        
        // Commit transaction
        connection.db.run('COMMIT');
        
        logger.debug('Transaction completed successfully', {
          database: { connectionId: connection.id }
        });
        
        return finalResult;
      } catch (error) {
        // Rollback transaction
        try {
          connection.db.run('ROLLBACK');
          logger.debug('Transaction rolled back', {
            database: { connectionId: connection.id, error: (error as Error).message }
          });
        } catch (rollbackError) {
          logger.error('Failed to rollback transaction', rollbackError as Error, {
            database: { connectionId: connection.id }
          });
        }
        throw error;
      }
    } catch (error) {
      logger.error('Transaction failed', error as Error, {
        database: { connectionId: connection?.id }
      });
      throw new DatabaseError(
        'Transaction failed',
        'transaction',
        undefined,
        true,
        undefined,
        error as Error
      );
    } finally {
      if (connection) {
        this.releaseConnection(connection);
      }
    }
  }

  /**
   * Get pool statistics
   */
  getStats(): PoolStats {
    const now = Date.now();
    const activeConnections = Array.from(this.connections.values()).filter(conn => conn.isActive).length;
    const healthyConnections = Array.from(this.connections.values()).filter(conn => 
      this.isConnectionHealthy(conn)
    ).length;

    return {
      totalConnections: this.connections.size,
      activeConnections,
      idleConnections: this.connections.size - activeConnections,
      waitingRequests: this.waitingQueue.length,
      totalQueries: this.totalQueries,
      averageResponseTime: this.totalQueries > 0 ? this.totalResponseTime / this.totalQueries : 0,
      healthyConnections,
      recycledConnections: this.recycledConnections,
    };
  }

  /**
   * Shutdown the connection pool
   */
  async shutdown(): Promise<void> {
    if (this.isShutdown) return;

    this.isShutdown = true;

    // Stop health check
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    // Reject all waiting requests
    while (this.waitingQueue.length > 0) {
      const waiting = this.waitingQueue.shift()!;
      waiting.reject(new DatabaseConnectionError(
        'Connection pool is shutting down',
        'pool_shutdown'
      ));
    }

    // Close all connections
    for (const connection of this.connections.values()) {
      try {
        connection.db.close();
      } catch (error) {
        logger.error('Error closing connection during shutdown', error as Error, {
          database: { connectionId: connection.id }
        });
      }
    }

    this.connections.clear();

    logger.info('Connection pool shutdown completed', {
      database: { 
        pool: { 
          recycledConnections: this.recycledConnections,
          totalQueries: this.totalQueries
        }
      }
    });
  }

  /**
   * Create a new database connection
   */
  private async createConnection(): Promise<PooledConnection> {
    const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const db = new Database(this.dbPath, { create: true });
      
      // Test the connection
      db.run('SELECT 1');
      
      const connection: PooledConnection = {
        db,
        id: connectionId,
        isActive: false,
        lastUsed: Date.now(),
        created: Date.now(),
        queryCount: 0,
      };

      this.connections.set(connectionId, connection);

      logger.debug('New database connection created', {
        database: { 
          connectionId,
          totalConnections: this.connections.size
        }
      });

      return connection;
    } catch (error) {
      logger.error('Failed to create database connection', error as Error, {
        database: { connectionId }
      });
      throw new DatabaseConnectionError(
        'Failed to create database connection',
        'create_connection',
        connectionId,
        false,
        error as Error
      );
    }
  }

  /**
   * Find an available connection
   */
  private findAvailableConnection(): PooledConnection | null {
    for (const connection of this.connections.values()) {
      if (!connection.isActive && this.isConnectionHealthy(connection)) {
        return connection;
      }
    }
    return null;
  }

  /**
   * Check if a connection is healthy
   */
  private isConnectionHealthy(connection: PooledConnection): boolean {
    const now = Date.now();
    
    // Check if connection is too old
    if (now - connection.created > this.options.maxConnectionAge) {
      return false;
    }

    // Check if connection has been idle too long
    if (!connection.isActive && now - connection.lastUsed > this.options.idleTimeout) {
      return false;
    }

    // Check if connection has handled too many queries
    if (connection.queryCount >= this.options.maxQueriesPerConnection) {
      return false;
    }

    return true;
  }

  /**
   * Check if a connection should be recycled
   */
  private shouldRecycleConnection(connection: PooledConnection): boolean {
    return !this.isConnectionHealthy(connection);
  }

  /**
   * Recycle a connection
   */
  private async recycleConnection(connection: PooledConnection): Promise<void> {
    try {
      // Close the old connection
      connection.db.close();
      this.connections.delete(connection.id);
      this.recycledConnections++;

      logger.debug('Connection recycled', {
        database: { 
          connectionId: connection.id,
          queryCount: connection.queryCount,
          age: Date.now() - connection.created
        }
      });

      // Create a new connection to maintain minimum pool size
      if (this.connections.size < this.options.minConnections) {
        await this.createConnection();
      }

      // If there are waiting requests and we can serve them
      if (this.waitingQueue.length > 0 && this.connections.size < this.options.maxConnections) {
        const newConnection = await this.createConnection();
        const waiting = this.waitingQueue.shift()!;
        newConnection.isActive = true;
        waiting.resolve(newConnection);
      }
    } catch (error) {
      logger.error('Failed to recycle connection', error as Error, {
        database: { connectionId: connection.id }
      });
    }
  }

  /**
   * Start health check interval
   */
  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.options.healthCheckInterval);
  }

  /**
   * Perform health check on all connections
   */
  private performHealthCheck(): void {
    const unhealthyConnections: string[] = [];
    const now = Date.now();

    for (const [id, connection] of this.connections.entries()) {
      if (!connection.isActive && !this.isConnectionHealthy(connection)) {
        unhealthyConnections.push(id);
      }
    }

    // Recycle unhealthy connections
    unhealthyConnections.forEach(async (id) => {
      const connection = this.connections.get(id);
      if (connection) {
        await this.recycleConnection(connection);
      }
    });

    // Clean up timed-out waiting requests
    const expiredRequests: number[] = [];
    this.waitingQueue.forEach((request, index) => {
      if (now - request.timestamp > this.options.connectionTimeout) {
        expiredRequests.push(index);
      }
    });

    // Remove expired requests (in reverse order to maintain indices)
    expiredRequests.reverse().forEach(index => {
      const expired = this.waitingQueue.splice(index, 1)[0];
      expired.reject(new DatabaseConnectionError(
        'Connection request timed out',
        'connection_timeout'
      ));
    });

    if (unhealthyConnections.length > 0 || expiredRequests.length > 0) {
      logger.debug('Health check completed', {
        database: { 
          pool: {
            recycledConnections: unhealthyConnections.length,
            expiredRequests: expiredRequests.length,
            totalConnections: this.connections.size,
            waitingRequests: this.waitingQueue.length
          }
        }
      });
    }
  }

  /**
   * Record query metrics
   */
  private recordQueryMetrics(responseTime: number): void {
    this.totalQueries++;
    this.totalResponseTime += responseTime;
  }
}

// Singleton connection pool instance
let connectionPool: ConnectionPool | null = null;

/**
 * Initialize the global connection pool
 */
export function initializeConnectionPool(
  dbPath: string, 
  options?: Partial<ConnectionPoolOptions>
): ConnectionPool {
  if (connectionPool) {
    logger.warn('Connection pool already initialized, returning existing instance');
    return connectionPool;
  }

  const finalOptions: ConnectionPoolOptions = {
    minConnections: 2,
    maxConnections: 10,
    connectionTimeout: 5000,
    idleTimeout: 300000, // 5 minutes
    healthCheckInterval: 60000, // 1 minute
    maxConnectionAge: 3600000, // 1 hour
    maxQueriesPerConnection: 1000,
    ...options,
  };

  connectionPool = new ConnectionPool(dbPath, finalOptions);
  return connectionPool;
}

/**
 * Get the global connection pool instance
 */
export function getConnectionPool(): ConnectionPool {
  if (!connectionPool) {
    throw new DatabaseConnectionError(
      'Connection pool not initialized. Call initializeConnectionPool() first.',
      'pool_not_initialized'
    );
  }
  return connectionPool;
}

/**
 * Shutdown the global connection pool
 */
export async function shutdownConnectionPool(): Promise<void> {
  if (connectionPool) {
    await connectionPool.shutdown();
    connectionPool = null;
  }
}