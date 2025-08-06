import { Database } from "bun:sqlite";
import { getConnectionPool } from "./connection-pool";
import { withTransaction } from "./transactions";
import { logger } from "../monitoring/logger";
import { DatabaseError } from "../errors/ai-errors";

export interface Migration {
  id: number;
  name: string;
  description: string;
  up: (db: Database) => Promise<void> | void;
  down: (db: Database) => Promise<void> | void;
  dependencies?: number[]; // Migration IDs this migration depends on
}

export interface MigrationRecord {
  id: number;
  name: string;
  applied_at: string;
  checksum: string;
  execution_time: number;
}

export interface MigrationStats {
  totalMigrations: number;
  appliedMigrations: number;
  pendingMigrations: number;
  lastMigration?: MigrationRecord;
  migrationHistory: MigrationRecord[];
}

export class MigrationManager {
  private migrations: Map<number, Migration> = new Map();
  private isInitialized = false;

  constructor() {
    this.registerBuiltInMigrations();
  }

  /**
   * Initialize the migration system by creating the migrations table
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await withTransaction(async (db) => {
        // Create migrations table to track applied migrations
        db.run(`
          CREATE TABLE IF NOT EXISTS schema_migrations (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            checksum TEXT NOT NULL,
            execution_time INTEGER NOT NULL
          )
        `);

        // Create an index for faster lookups
        db.run(`
          CREATE INDEX IF NOT EXISTS idx_schema_migrations_id 
          ON schema_migrations(id)
        `);
      });

      this.isInitialized = true;

      logger.info('Migration system initialized successfully', {
        database: { migrations: { system: 'initialized' } }
      });
    } catch (error) {
      logger.error('Failed to initialize migration system', error as Error, {
        database: { migrations: { operation: 'initialize' } }
      });
      throw new DatabaseError(
        'Failed to initialize migration system',
        'migration_init',
        undefined,
        false,
        undefined,
        error as Error
      );
    }
  }

  /**
   * Register a migration
   */
  registerMigration(migration: Migration): void {
    if (this.migrations.has(migration.id)) {
      throw new DatabaseError(
        `Migration with ID ${migration.id} is already registered`,
        'duplicate_migration',
        migration.name,
        false
      );
    }

    // Validate dependencies
    if (migration.dependencies) {
      for (const depId of migration.dependencies) {
        if (!this.migrations.has(depId)) {
          throw new DatabaseError(
            `Migration ${migration.id} depends on migration ${depId} which is not registered`,
            'missing_dependency',
            migration.name,
            false
          );
        }
      }
    }

    this.migrations.set(migration.id, migration);

    logger.debug('Migration registered', {
      database: {
        migrations: {
          id: migration.id,
          name: migration.name,
          dependencies: migration.dependencies
        }
      }
    });
  }

  /**
   * Run all pending migrations
   */
  async migrate(): Promise<MigrationRecord[]> {
    await this.ensureInitialized();

    const appliedMigrations = await this.getAppliedMigrations();
    const appliedIds = new Set(appliedMigrations.map(m => m.id));
    
    // Get pending migrations in dependency order
    const pendingMigrations = this.getPendingMigrationsInOrder(appliedIds);

    if (pendingMigrations.length === 0) {
      logger.info('No pending migrations to apply');
      return [];
    }

    const results: MigrationRecord[] = [];

    logger.info(`Applying ${pendingMigrations.length} pending migrations`, {
      database: {
        migrations: {
          pending: pendingMigrations.length,
          migrations: pendingMigrations.map(m => ({ id: m.id, name: m.name }))
        }
      }
    });

    // Apply each migration in a separate transaction for better error isolation
    for (const migration of pendingMigrations) {
      try {
        const record = await this.applyMigration(migration);
        results.push(record);

        logger.info(`Migration applied successfully`, {
          database: {
            migrations: {
              id: migration.id,
              name: migration.name,
              executionTime: record.execution_time
            }
          }
        });
      } catch (error) {
        logger.error(`Failed to apply migration ${migration.id}: ${migration.name}`, error as Error, {
          database: {
            migrations: {
              failedMigration: { id: migration.id, name: migration.name }
            }
          }
        });
        throw new DatabaseError(
          `Migration ${migration.id} (${migration.name}) failed`,
          'migration_failed',
          migration.name,
          true,
          undefined,
          error as Error
        );
      }
    }

    logger.info(`Successfully applied ${results.length} migrations`, {
      database: {
        migrations: {
          applied: results.length,
          totalExecutionTime: results.reduce((sum, r) => sum + r.execution_time, 0)
        }
      }
    });

    return results;
  }

  /**
   * Rollback the last N migrations
   */
  async rollback(steps: number = 1): Promise<MigrationRecord[]> {
    await this.ensureInitialized();

    if (steps < 1) {
      throw new DatabaseError('Rollback steps must be greater than 0', 'invalid_rollback_steps', undefined, false);
    }

    const appliedMigrations = await this.getAppliedMigrations();
    
    // Get the last N migrations to rollback (in reverse order)
    const toRollback = appliedMigrations
      .sort((a, b) => b.id - a.id) // Sort by ID descending
      .slice(0, steps);

    if (toRollback.length === 0) {
      logger.info('No migrations to rollback');
      return [];
    }

    logger.info(`Rolling back ${toRollback.length} migrations`, {
      database: {
        migrations: {
          rollback: toRollback.length,
          migrations: toRollback.map(m => ({ id: m.id, name: m.name }))
        }
      }
    });

    const results: MigrationRecord[] = [];

    // Rollback each migration
    for (const migrationRecord of toRollback) {
      try {
        const migration = this.migrations.get(migrationRecord.id);
        if (!migration) {
          throw new DatabaseError(
            `Migration ${migrationRecord.id} not found in registry`,
            'migration_not_found',
            migrationRecord.name,
            false
          );
        }

        await this.rollbackMigration(migration, migrationRecord);
        results.push(migrationRecord);

        logger.info(`Migration rolled back successfully`, {
          database: {
            migrations: {
              id: migration.id,
              name: migration.name
            }
          }
        });
      } catch (error) {
        logger.error(`Failed to rollback migration ${migrationRecord.id}: ${migrationRecord.name}`, error as Error);
        throw new DatabaseError(
          `Rollback of migration ${migrationRecord.id} (${migrationRecord.name}) failed`,
          'rollback_failed',
          migrationRecord.name,
          true,
          undefined,
          error as Error
        );
      }
    }

    return results;
  }

  /**
   * Get migration statistics
   */
  async getStats(): Promise<MigrationStats> {
    await this.ensureInitialized();

    const appliedMigrations = await this.getAppliedMigrations();
    const totalMigrations = this.migrations.size;
    const pendingMigrations = totalMigrations - appliedMigrations.length;

    return {
      totalMigrations,
      appliedMigrations: appliedMigrations.length,
      pendingMigrations,
      lastMigration: appliedMigrations.sort((a, b) => b.id - a.id)[0],
      migrationHistory: appliedMigrations.sort((a, b) => a.id - b.id),
    };
  }

  /**
   * Check if the database schema is up to date
   */
  async isUpToDate(): Promise<boolean> {
    const stats = await this.getStats();
    return stats.pendingMigrations === 0;
  }

  /**
   * Validate migration integrity
   */
  async validateMigrations(): Promise<{ valid: boolean; errors: string[] }> {
    await this.ensureInitialized();

    const errors: string[] = [];
    const appliedMigrations = await this.getAppliedMigrations();

    // Check for missing migrations
    for (const applied of appliedMigrations) {
      if (!this.migrations.has(applied.id)) {
        errors.push(`Applied migration ${applied.id} (${applied.name}) is not registered`);
      }
    }

    // Check for checksum mismatches (if we had checksums in the original records)
    for (const applied of appliedMigrations) {
      const migration = this.migrations.get(applied.id);
      if (migration) {
        const currentChecksum = this.calculateMigrationChecksum(migration);
        if (applied.checksum !== currentChecksum) {
          errors.push(`Migration ${applied.id} (${applied.name}) checksum mismatch - migration may have been modified`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Apply a single migration
   */
  private async applyMigration(migration: Migration): Promise<MigrationRecord> {
    const startTime = Date.now();
    const checksum = this.calculateMigrationChecksum(migration);

    await withTransaction(async (db) => {
      // Execute the migration
      await migration.up(db);

      // Record the migration as applied
      db.run(`
        INSERT INTO schema_migrations (id, name, checksum, execution_time)
        VALUES (?, ?, ?, ?)
      `, [migration.id, migration.name, checksum, Date.now() - startTime]);
    });

    return {
      id: migration.id,
      name: migration.name,
      applied_at: new Date().toISOString(),
      checksum,
      execution_time: Date.now() - startTime,
    };
  }

  /**
   * Rollback a single migration
   */
  private async rollbackMigration(migration: Migration, record: MigrationRecord): Promise<void> {
    await withTransaction(async (db) => {
      // Execute the rollback
      await migration.down(db);

      // Remove the migration record
      db.run('DELETE FROM schema_migrations WHERE id = ?', [migration.id]);
    });
  }

  /**
   * Get all applied migrations from the database
   */
  private async getAppliedMigrations(): Promise<MigrationRecord[]> {
    const pool = getConnectionPool();
    return await pool.query<MigrationRecord[]>(
      'SELECT * FROM schema_migrations ORDER BY id ASC',
      [],
      'all'
    );
  }

  /**
   * Get pending migrations in dependency order
   */
  private getPendingMigrationsInOrder(appliedIds: Set<number>): Migration[] {
    const pending = Array.from(this.migrations.values())
      .filter(m => !appliedIds.has(m.id));

    // Sort by dependencies using topological sort
    return this.topologicalSort(pending);
  }

  /**
   * Perform topological sort on migrations based on dependencies
   */
  private topologicalSort(migrations: Migration[]): Migration[] {
    const result: Migration[] = [];
    const visited = new Set<number>();
    const visiting = new Set<number>();

    const visit = (migration: Migration) => {
      if (visiting.has(migration.id)) {
        throw new DatabaseError(
          `Circular dependency detected involving migration ${migration.id}`,
          'circular_dependency',
          migration.name,
          false
        );
      }

      if (visited.has(migration.id)) {
        return;
      }

      visiting.add(migration.id);

      // Visit dependencies first
      if (migration.dependencies) {
        for (const depId of migration.dependencies) {
          const dep = migrations.find(m => m.id === depId);
          if (dep) {
            visit(dep);
          }
        }
      }

      visiting.delete(migration.id);
      visited.add(migration.id);
      result.push(migration);
    };

    // Visit all migrations
    for (const migration of migrations) {
      if (!visited.has(migration.id)) {
        visit(migration);
      }
    }

    return result;
  }

  /**
   * Calculate a checksum for a migration to detect changes
   */
  private calculateMigrationChecksum(migration: Migration): string {
    const content = `${migration.id}-${migration.name}-${migration.description}-${migration.up.toString()}`;
    
    // Simple checksum - in production you might want to use a proper hash function
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    return Math.abs(hash).toString(36);
  }

  /**
   * Ensure the migration system is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  /**
   * Register built-in migrations
   */
  private registerBuiltInMigrations(): void {
    // Migration 1: Create base tables (if they don't exist)
    this.registerMigration({
      id: 1,
      name: 'create_base_tables',
      description: 'Create base application tables',
      up: async (db: Database) => {
        // Create apps table
        db.run(`
          CREATE TABLE IF NOT EXISTS apps (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            spec TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Create app_data table
        db.run(`
          CREATE TABLE IF NOT EXISTS app_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            app_id INTEGER NOT NULL,
            entity_type TEXT NOT NULL,
            data TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE
          )
        `);

        // Create dynamic_data table
        db.run(`
          CREATE TABLE IF NOT EXISTS dynamic_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            collection TEXT NOT NULL,
            data TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        logger.info('Created base application tables');
      },
      down: async (db: Database) => {
        db.run('DROP TABLE IF EXISTS dynamic_data');
        db.run('DROP TABLE IF EXISTS app_data');
        db.run('DROP TABLE IF EXISTS apps');
        
        logger.info('Dropped base application tables');
      },
    });

    // Migration 2: Add user_id column to dynamic_data table
    this.registerMigration({
      id: 2,
      name: 'add_user_id_to_dynamic_data',
      description: 'Add user_id column to dynamic_data table for user-scoped data access',
      dependencies: [1], // Depends on base tables
      up: async (db: Database) => {
        // Check if column already exists
        const tableInfo = db.prepare("PRAGMA table_info(dynamic_data)").all() as any[];
        const hasUserIdColumn = tableInfo.some((column: any) => column.name === 'user_id');

        if (!hasUserIdColumn) {
          // Add user_id column (nullable for backward compatibility)
          db.run(`
            ALTER TABLE dynamic_data 
            ADD COLUMN user_id TEXT NULL
          `);
          
          logger.info('Added user_id column to dynamic_data table');
        } else {
          logger.info('user_id column already exists in dynamic_data table');
        }

        // Create index for efficient user-based queries
        db.run(`
          CREATE INDEX IF NOT EXISTS idx_dynamic_data_user_id 
          ON dynamic_data(user_id)
        `);

        // Create composite index for user + collection queries
        db.run(`
          CREATE INDEX IF NOT EXISTS idx_dynamic_data_user_collection 
          ON dynamic_data(user_id, collection)
        `);

        logger.info('Created indexes for user_id column');
      },
      down: async (db: Database) => {
        // Drop the indexes first
        db.run('DROP INDEX IF EXISTS idx_dynamic_data_user_id');
        db.run('DROP INDEX IF EXISTS idx_dynamic_data_user_collection');

        // SQLite doesn't support DROP COLUMN directly, so we need to recreate the table
        db.run('BEGIN TRANSACTION');
        
        // Create new table without user_id column
        db.run(`
          CREATE TABLE dynamic_data_backup (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            collection TEXT NOT NULL,
            data TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Copy data (excluding user_id column)
        db.run(`
          INSERT INTO dynamic_data_backup (id, collection, data, created_at, updated_at)
          SELECT id, collection, data, created_at, updated_at FROM dynamic_data
        `);

        // Drop original table and rename backup
        db.run('DROP TABLE dynamic_data');
        db.run('ALTER TABLE dynamic_data_backup RENAME TO dynamic_data');
        
        db.run('COMMIT');

        logger.info('Removed user_id column from dynamic_data table');
      },
    });

    // Migration 3: Add indexes for better performance
    this.registerMigration({
      id: 3,
      name: 'add_performance_indexes',
      description: 'Add indexes for better query performance',
      dependencies: [1, 2], // Depends on base tables and user_id column
      up: async (db: Database) => {
        // Add indexes for apps table
        db.run(`
          CREATE INDEX IF NOT EXISTS idx_apps_created_at 
          ON apps(created_at DESC)
        `);

        // Add index for app_data table
        db.run(`
          CREATE INDEX IF NOT EXISTS idx_app_data_app_id 
          ON app_data(app_id)
        `);

        db.run(`
          CREATE INDEX IF NOT EXISTS idx_app_data_entity_type 
          ON app_data(entity_type)
        `);

        // Add index for dynamic_data timestamps
        db.run(`
          CREATE INDEX IF NOT EXISTS idx_dynamic_data_created_at 
          ON dynamic_data(created_at DESC)
        `);

        logger.info('Added performance indexes to all tables');
      },
      down: async (db: Database) => {
        db.run('DROP INDEX IF EXISTS idx_apps_created_at');
        db.run('DROP INDEX IF EXISTS idx_app_data_app_id');
        db.run('DROP INDEX IF EXISTS idx_app_data_entity_type');
        db.run('DROP INDEX IF EXISTS idx_dynamic_data_created_at');

        logger.info('Removed performance indexes');
      },
    });
  }
}

// Singleton migration manager instance
export const migrationManager = new MigrationManager();

/**
 * Initialize and run migrations
 */
export async function runMigrations(): Promise<void> {
  await migrationManager.initialize();
  await migrationManager.migrate();
}

/**
 * Check if database is up to date
 */
export async function isDatabaseUpToDate(): Promise<boolean> {
  await migrationManager.initialize();
  return await migrationManager.isUpToDate();
}

/**
 * Get migration statistics
 */
export async function getMigrationStats(): Promise<MigrationStats> {
  await migrationManager.initialize();
  return await migrationManager.getStats();
}