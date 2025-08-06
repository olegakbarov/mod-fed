import { db } from './database';
import fs from 'fs';
import path from 'path';

// Simple migration runner
export class MigrationRunner {
  private migrationsPath: string;

  constructor(migrationsPath = path.join(process.cwd(), 'migrations')) {
    this.migrationsPath = migrationsPath;
    this.initializeMigrationsTable();
  }

  private initializeMigrationsTable() {
    // Create migrations tracking table
    db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT UNIQUE NOT NULL,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  private getAppliedMigrations(): Set<string> {
    const applied = db.prepare('SELECT filename FROM migrations').all() as { filename: string }[];
    return new Set(applied.map(m => m.filename));
  }

  private getMigrationFiles(): string[] {
    if (!fs.existsSync(this.migrationsPath)) {
      console.log(`Migrations directory ${this.migrationsPath} does not exist`);
      return [];
    }

    return fs.readdirSync(this.migrationsPath)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Ensure migrations run in order
  }

  private recordMigration(filename: string) {
    const stmt = db.prepare('INSERT INTO migrations (filename) VALUES (?)');
    stmt.run(filename);
  }

  public async runMigrations(): Promise<void> {
    const appliedMigrations = this.getAppliedMigrations();
    const migrationFiles = this.getMigrationFiles();

    console.log(`Found ${migrationFiles.length} migration files`);
    console.log(`${appliedMigrations.size} migrations already applied`);

    for (const filename of migrationFiles) {
      if (appliedMigrations.has(filename)) {
        console.log(`Skipping already applied migration: ${filename}`);
        continue;
      }

      console.log(`Applying migration: ${filename}`);
      
      try {
        const migrationPath = path.join(this.migrationsPath, filename);
        const sql = fs.readFileSync(migrationPath, 'utf8');
        
        // Run migration in a transaction
        const migrate = db.transaction(() => {
          db.exec(sql);
          this.recordMigration(filename);
        });
        
        migrate();
        console.log(`Successfully applied migration: ${filename}`);
      } catch (error) {
        console.error(`Failed to apply migration ${filename}:`, error);
        throw error;
      }
    }

    console.log('All migrations completed');
  }

  public getStatus(): { applied: string[], pending: string[] } {
    const appliedMigrations = this.getAppliedMigrations();
    const migrationFiles = this.getMigrationFiles();

    return {
      applied: Array.from(appliedMigrations).sort(),
      pending: migrationFiles.filter(file => !appliedMigrations.has(file))
    };
  }
}

// Create and export default migration runner instance
export const migrationRunner = new MigrationRunner();

// Helper function to run migrations
export const runMigrations = () => migrationRunner.runMigrations();