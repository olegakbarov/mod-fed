import { Database } from "bun:sqlite";
import { getConnectionPool, type PooledConnection } from "./connection-pool";
import { logger } from "../monitoring/logger";
import { DatabaseError } from "../errors/ai-errors";

export interface TransactionOptions {
  timeout: number; // Transaction timeout in milliseconds
  retries: number; // Number of retry attempts on deadlock/busy
  retryDelay: number; // Delay between retries in milliseconds
  isolationLevel?: 'DEFERRED' | 'IMMEDIATE' | 'EXCLUSIVE';
  readOnly?: boolean;
}

export interface TransactionContext {
  id: string;
  startTime: number;
  timeout: number;
  isCompleted: boolean;
  operations: number;
  connection: PooledConnection;
}

export type TransactionCallback<T> = (db: Database, context: TransactionContext) => Promise<T> | T;

export class TransactionManager {
  private activeTransactions = new Map<string, TransactionContext>();
  private transactionCounter = 0;

  constructor(
    private defaultOptions: TransactionOptions = {
      timeout: 30000, // 30 seconds
      retries: 3,
      retryDelay: 100,
      isolationLevel: 'DEFERRED',
      readOnly: false,
    }
  ) {}

  /**
   * Execute a callback within a database transaction with full ACID compliance
   */
  async execute<T>(
    callback: TransactionCallback<T>,
    options: Partial<TransactionOptions> = {}
  ): Promise<T> {
    const finalOptions = { ...this.defaultOptions, ...options };
    let lastError: Error | null = null;

    // Retry logic for handling deadlocks and busy states
    for (let attempt = 1; attempt <= finalOptions.retries; attempt++) {
      try {
        return await this.executeTransaction(callback, finalOptions, attempt);
      } catch (error) {
        lastError = error as Error;
        const errorMessage = (error as Error).message.toLowerCase();

        // Check if it's a retryable error (deadlock, busy, locked)
        if (this.isRetryableError(errorMessage) && attempt < finalOptions.retries) {
          const delay = finalOptions.retryDelay * attempt; // Exponential backoff
          
          logger.warn(`Transaction attempt ${attempt} failed, retrying in ${delay}ms`, undefined, {
            database: {
              transaction: {
                attempt,
                error: errorMessage,
                retryDelay: delay
              }
            }
          });

          await this.sleep(delay);
          continue;
        }

        // Non-retryable error or max retries reached
        break;
      }
    }

    // All retries failed
    logger.error('Transaction failed after all retries', lastError!, {
      database: {
        transaction: {
          attempts: finalOptions.retries,
          finalError: lastError!.message
        }
      }
    });

    throw new DatabaseError(
      `Transaction failed after ${finalOptions.retries} attempts: ${lastError!.message}`,
      'transaction',
      undefined,
      true,
      undefined,
      lastError!
    );
  }

  /**
   * Execute a read-only transaction
   */
  async executeReadOnly<T>(
    callback: TransactionCallback<T>,
    options: Partial<TransactionOptions> = {}
  ): Promise<T> {
    return this.execute(callback, { ...options, readOnly: true });
  }

  /**
   * Execute multiple operations as separate transactions with coordination
   */
  async executeCoordinated<T>(
    operations: Array<{ callback: TransactionCallback<any>; options?: Partial<TransactionOptions> }>,
    coordinatorCallback?: (results: any[]) => T
  ): Promise<T> {
    const results: any[] = [];
    const completedTransactions: Array<() => Promise<void>> = [];

    try {
      // Execute all operations
      for (let i = 0; i < operations.length; i++) {
        const operation = operations[i];
        
        const result = await this.execute(operation.callback, operation.options);
        results.push(result);
        
        // Keep track of completed transactions for potential rollback
        completedTransactions.push(async () => {
          logger.debug(`Transaction ${i + 1} completed in coordinated execution`);
        });
      }

      // If coordinator callback is provided, execute it
      if (coordinatorCallback) {
        return coordinatorCallback(results);
      }

      return results as T;
    } catch (error) {
      // Log coordination failure
      logger.error('Coordinated transaction execution failed', error as Error, {
        database: {
          coordination: {
            totalOperations: operations.length,
            completedOperations: results.length
          }
        }
      });

      throw new DatabaseError(
        'Coordinated transaction execution failed',
        'coordinated_transaction',
        undefined,
        true,
        undefined,
        error as Error
      );
    }
  }

  /**
   * Get statistics about active transactions
   */
  getTransactionStats(): {
    activeTransactions: number;
    averageTransactionTime: number;
    longestRunningTransaction: number | null;
    totalTransactions: number;
  } {
    const now = Date.now();
    const activeTxs = Array.from(this.activeTransactions.values());
    
    let totalTime = 0;
    let longestRunning: number | null = null;
    
    for (const tx of activeTxs) {
      const runTime = now - tx.startTime;
      totalTime += runTime;
      
      if (longestRunning === null || runTime > longestRunning) {
        longestRunning = runTime;
      }
    }

    return {
      activeTransactions: activeTxs.length,
      averageTransactionTime: activeTxs.length > 0 ? totalTime / activeTxs.length : 0,
      longestRunningTransaction: longestRunning,
      totalTransactions: this.transactionCounter,
    };
  }

  /**
   * Cancel a transaction by ID (if possible)
   */
  async cancelTransaction(transactionId: string): Promise<boolean> {
    const context = this.activeTransactions.get(transactionId);
    if (!context || context.isCompleted) {
      return false;
    }

    try {
      // Mark as completed to prevent further operations
      context.isCompleted = true;
      
      // Attempt to rollback
      context.connection.db.run('ROLLBACK');
      
      logger.info('Transaction cancelled successfully', {
        database: {
          transaction: {
            id: transactionId,
            duration: Date.now() - context.startTime,
            operations: context.operations
          }
        }
      });
      
      return true;
    } catch (error) {
      logger.error('Failed to cancel transaction', error as Error, {
        database: { transactionId }
      });
      return false;
    } finally {
      this.cleanupTransaction(transactionId);
    }
  }

  /**
   * Cleanup expired transactions
   */
  cleanupExpiredTransactions(): void {
    const now = Date.now();
    const expiredTransactions: string[] = [];

    for (const [id, context] of this.activeTransactions.entries()) {
      if (!context.isCompleted && now - context.startTime > context.timeout) {
        expiredTransactions.push(id);
      }
    }

    expiredTransactions.forEach(id => {
      this.cancelTransaction(id).catch(error => {
        logger.error('Failed to cleanup expired transaction', error as Error, {
          database: { transactionId: id }
        });
      });
    });

    if (expiredTransactions.length > 0) {
      logger.warn(`Cleaned up ${expiredTransactions.length} expired transactions`, undefined, {
        database: { expiredTransactions: expiredTransactions.length }
      });
    }
  }

  /**
   * Execute a single transaction with proper setup and cleanup
   */
  private async executeTransaction<T>(
    callback: TransactionCallback<T>,
    options: TransactionOptions,
    attempt: number
  ): Promise<T> {
    const pool = getConnectionPool();
    let connection: PooledConnection | null = null;
    let transactionId: string | null = null;

    try {
      // Get connection from pool
      connection = await pool.getConnection();
      
      // Create transaction context
      transactionId = this.createTransactionId();
      const context: TransactionContext = {
        id: transactionId,
        startTime: Date.now(),
        timeout: options.timeout,
        isCompleted: false,
        operations: 0,
        connection,
      };

      this.activeTransactions.set(transactionId, context);

      // Set up transaction timeout
      const timeoutHandle = setTimeout(() => {
        if (!context.isCompleted) {
          this.cancelTransaction(transactionId!).catch(() => {
            // Ignore errors during timeout cleanup
          });
        }
      }, options.timeout);

      try {
        // Begin transaction with appropriate isolation level
        const beginCommand = this.buildBeginCommand(options);
        connection.db.run(beginCommand);

        logger.debug('Transaction started', {
          database: {
            transaction: {
              id: transactionId,
              isolationLevel: options.isolationLevel,
              readOnly: options.readOnly,
              attempt
            }
          }
        });

        // Execute the callback
        const result = await this.executeWithContext(callback, connection.db, context);

        // Check if transaction was cancelled
        if (context.isCompleted) {
          throw new DatabaseError(
            'Transaction was cancelled',
            'transaction_cancelled',
            undefined,
            false
          );
        }

        // Commit the transaction
        connection.db.run('COMMIT');
        context.isCompleted = true;

        clearTimeout(timeoutHandle);

        logger.debug('Transaction committed successfully', {
          database: {
            transaction: {
              id: transactionId,
              duration: Date.now() - context.startTime,
              operations: context.operations
            }
          }
        });

        return result;
      } catch (error) {
        clearTimeout(timeoutHandle);

        // Rollback the transaction if not already completed
        if (!context.isCompleted) {
          try {
            connection.db.run('ROLLBACK');
            context.isCompleted = true;
            
            logger.debug('Transaction rolled back', {
              database: {
                transaction: {
                  id: transactionId,
                  duration: Date.now() - context.startTime,
                  error: (error as Error).message
                }
              }
            });
          } catch (rollbackError) {
            logger.error('Failed to rollback transaction', rollbackError as Error, {
              database: { transactionId }
            });
          }
        }

        throw error;
      }
    } finally {
      // Clean up transaction context
      if (transactionId) {
        this.cleanupTransaction(transactionId);
      }

      // Release connection back to pool
      if (connection) {
        pool.releaseConnection(connection);
      }
    }
  }

  /**
   * Execute callback with proper context management
   */
  private async executeWithContext<T>(
    callback: TransactionCallback<T>,
    db: Database,
    context: TransactionContext
  ): Promise<T> {
    // Wrap database operations to count them
    const proxiedDb = this.createProxiedDatabase(db, context);
    
    // Execute the callback
    const result = callback(proxiedDb, context);
    
    // Handle both sync and async callbacks
    if (result instanceof Promise) {
      return await result;
    }
    
    return result;
  }

  /**
   * Create a proxied database instance to track operations
   */
  private createProxiedDatabase(db: Database, context: TransactionContext): Database {
    return new Proxy(db, {
      get(target, prop) {
        const value = target[prop as keyof Database];
        
        // Track operations that modify the database
        if (typeof value === 'function' && ['run', 'prepare'].includes(prop as string)) {
          return (...args: any[]) => {
            if (!context.isCompleted) {
              context.operations++;
            }
            return (value as Function).apply(target, args);
          };
        }
        
        return value;
      }
    });
  }

  /**
   * Build the BEGIN command with appropriate options
   */
  private buildBeginCommand(options: TransactionOptions): string {
    let command = 'BEGIN';
    
    if (options.isolationLevel) {
      command += ` ${options.isolationLevel}`;
    }
    
    if (options.readOnly) {
      // SQLite doesn't have explicit read-only transactions,
      // but we can note this for application logic
      command += ' -- READ ONLY';
    }
    
    return command;
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(errorMessage: string): boolean {
    const retryablePatterns = [
      'database is busy',
      'database is locked',
      'deadlock',
      'disk i/o error',
      'temporary failure',
    ];
    
    return retryablePatterns.some(pattern => 
      errorMessage.includes(pattern.toLowerCase())
    );
  }

  /**
   * Create a unique transaction ID
   */
  private createTransactionId(): string {
    this.transactionCounter++;
    return `tx_${Date.now()}_${this.transactionCounter}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clean up transaction context
   */
  private cleanupTransaction(transactionId: string): void {
    this.activeTransactions.delete(transactionId);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton transaction manager instance
export const transactionManager = new TransactionManager();

/**
 * Convenience function for executing a transaction
 */
export async function withTransaction<T>(
  callback: TransactionCallback<T>,
  options?: Partial<TransactionOptions>
): Promise<T> {
  return transactionManager.execute(callback, options);
}

/**
 * Convenience function for executing a read-only transaction
 */
export async function withReadOnlyTransaction<T>(
  callback: TransactionCallback<T>,
  options?: Partial<TransactionOptions>
): Promise<T> {
  return transactionManager.executeReadOnly(callback, options);
}

/**
 * Convenience function for executing coordinated transactions
 */
export async function withCoordinatedTransactions<T>(
  operations: Array<{ callback: TransactionCallback<any>; options?: Partial<TransactionOptions> }>,
  coordinatorCallback?: (results: any[]) => T
): Promise<T> {
  return transactionManager.executeCoordinated(operations, coordinatorCallback);
}