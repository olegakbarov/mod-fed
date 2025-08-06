import Database from 'better-sqlite3';
import path from 'path';

// Simple database implementation that initializes everything on first use
export class SimpleDatabase {
  private db: Database;
  private initialized = false;
  private _queries: any = {};

  constructor(dbPath?: string) {
    const finalPath = dbPath || path.join(process.cwd(), 'app.db');
    this.db = new Database(finalPath);
    
    // Enable WAL mode for better performance and concurrency
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = 1000');
    this.db.pragma('temp_store = MEMORY');
  }

  // Initialize the database schema and prepared statements
  async initialize() {
    if (this.initialized) return;

    // Run basic migrations inline for simplicity
    this.db.exec(`
      -- Create migrations table
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT UNIQUE NOT NULL,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Create users table
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      -- Create apps table
      CREATE TABLE IF NOT EXISTS apps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        spec TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Create app_data table
      CREATE TABLE IF NOT EXISTS app_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        app_id INTEGER NOT NULL,
        data TEXT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT NULL,
        FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_apps_user_id ON apps(user_id);
      CREATE INDEX IF NOT EXISTS idx_apps_created_at ON apps(created_at);
      CREATE INDEX IF NOT EXISTS idx_app_data_app_id ON app_data(app_id);
      CREATE INDEX IF NOT EXISTS idx_app_data_created_at ON app_data(created_at);
    `);

    // Prepare all statements
    this._queries = {
      // User queries
      getUserById: this.db.prepare('SELECT * FROM users WHERE id = ?'),
      getUserByEmail: this.db.prepare('SELECT * FROM users WHERE email = ?'),
      createUser: this.db.prepare(`
        INSERT INTO users (email, name, created_at, updated_at) 
        VALUES (?, ?, datetime('now'), datetime('now'))
      `),
      updateUser: this.db.prepare(`
        UPDATE users 
        SET name = ?, updated_at = datetime('now') 
        WHERE id = ?
      `),
      deleteUser: this.db.prepare('DELETE FROM users WHERE id = ?'),

      // App queries
      getAppById: this.db.prepare('SELECT * FROM apps WHERE id = ?'),
      getUserApps: this.db.prepare('SELECT * FROM apps WHERE user_id = ? ORDER BY created_at DESC'),
      createApp: this.db.prepare(`
        INSERT INTO apps (name, spec, user_id, created_at, updated_at) 
        VALUES (?, ?, ?, datetime('now'), datetime('now'))
      `),
      updateApp: this.db.prepare(`
        UPDATE apps 
        SET name = ?, spec = ?, updated_at = datetime('now') 
        WHERE id = ? AND user_id = ?
      `),
      deleteApp: this.db.prepare('DELETE FROM apps WHERE id = ? AND user_id = ?'),

      // App data queries
      getAppData: this.db.prepare('SELECT * FROM app_data WHERE app_id = ? ORDER BY created_at DESC'),
      getAppDataById: this.db.prepare('SELECT * FROM app_data WHERE id = ? AND app_id = ?'),
      createAppData: this.db.prepare(`
        INSERT INTO app_data (app_id, data, created_at) 
        VALUES (?, ?, datetime('now'))
      `),
      updateAppData: this.db.prepare(`
        UPDATE app_data 
        SET data = ?, updated_at = datetime('now') 
        WHERE id = ? AND app_id = ?
      `),
      deleteAppData: this.db.prepare('DELETE FROM app_data WHERE id = ? AND app_id = ?'),
      clearAppData: this.db.prepare('DELETE FROM app_data WHERE app_id = ?'),
    };

    this.initialized = true;
  }

  // Get queries (ensures initialization)
  get queries() {
    if (!this.initialized) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this._queries;
  }

  // Simple helper functions for CRUD operations
  get userHelpers() {
    const q = this.queries;
    return {
      getById: (id: number) => q.getUserById.get(id),
      getByEmail: (email: string) => q.getUserByEmail.get(email),
      create: (email: string, name: string) => q.createUser.run(email, name),
      update: (id: number, name: string) => q.updateUser.run(name, id),
      delete: (id: number) => q.deleteUser.run(id),
    };
  }

  get appHelpers() {
    const q = this.queries;
    return {
      getById: (id: number) => q.getAppById.get(id),
      getUserApps: (userId: number) => q.getUserApps.all(userId),
      create: (name: string, spec: string, userId: number) => q.createApp.run(name, spec, userId),
      update: (id: number, userId: number, name: string, spec: string) => 
        q.updateApp.run(name, spec, id, userId),
      delete: (id: number, userId: number) => q.deleteApp.run(id, userId),
    };
  }

  get appDataHelpers() {
    const q = this.queries;
    return {
      getByAppId: (appId: number) => q.getAppData.all(appId),
      getById: (id: number, appId: number) => q.getAppDataById.get(id, appId),
      create: (appId: number, data: string) => q.createAppData.run(appId, data),
      update: (id: number, appId: number, data: string) => 
        q.updateAppData.run(data, id, appId),
      delete: (id: number, appId: number) => q.deleteAppData.run(id, appId),
      clearAll: (appId: number) => q.clearAppData.run(appId),
    };
  }

  // Transaction helper
  get transaction() {
    return this.db.transaction.bind(this.db);
  }

  // Close database
  close() {
    this.db.close();
  }
}

// Create and export default instance
export const simpleDB = new SimpleDatabase();

// Export individual pieces for compatibility
export const db = simpleDB;
export const queries = new Proxy({}, {
  get(target, prop) {
    return simpleDB.queries[prop];
  }
});
export const userHelpers = new Proxy({}, {
  get(target, prop) {
    return simpleDB.userHelpers[prop];
  }
});
export const appHelpers = new Proxy({}, {
  get(target, prop) {
    return simpleDB.appHelpers[prop];
  }
});
export const appDataHelpers = new Proxy({}, {
  get(target, prop) {
    return simpleDB.appDataHelpers[prop];
  }
});
export const transaction = new Proxy(() => {}, {
  apply() {
    return simpleDB.transaction.apply(simpleDB, arguments as any);
  }
});

// Graceful shutdown
export const closeDatabase = () => simpleDB.close();

// Handle process termination
process.on('exit', closeDatabase);
process.on('SIGINT', () => {
  closeDatabase();
  process.exit(0);
});
process.on('SIGTERM', () => {
  closeDatabase();
  process.exit(0);
});