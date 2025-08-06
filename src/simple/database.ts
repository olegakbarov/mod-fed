import Database from 'better-sqlite3';
import path from 'path';

// Initialize database with WAL mode for better performance
const dbPath = path.join(process.cwd(), 'app.db');
export const db = new Database(dbPath);

// Enable WAL mode for better performance and concurrency
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = 1000');
db.pragma('temp_store = MEMORY');

// Prepare common queries as prepared statements
export const queries = {
  // User queries
  getUserById: db.prepare('SELECT * FROM users WHERE id = ?'),
  getUserByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
  createUser: db.prepare(`
    INSERT INTO users (email, name, created_at, updated_at) 
    VALUES (?, ?, datetime('now'), datetime('now'))
  `),
  updateUser: db.prepare(`
    UPDATE users 
    SET name = ?, updated_at = datetime('now') 
    WHERE id = ?
  `),
  deleteUser: db.prepare('DELETE FROM users WHERE id = ?'),

  // App queries
  getAppById: db.prepare('SELECT * FROM apps WHERE id = ?'),
  getUserApps: db.prepare('SELECT * FROM apps WHERE user_id = ? ORDER BY created_at DESC'),
  createApp: db.prepare(`
    INSERT INTO apps (name, spec, user_id, created_at, updated_at) 
    VALUES (?, ?, ?, datetime('now'), datetime('now'))
  `),
  updateApp: db.prepare(`
    UPDATE apps 
    SET name = ?, spec = ?, updated_at = datetime('now') 
    WHERE id = ? AND user_id = ?
  `),
  deleteApp: db.prepare('DELETE FROM apps WHERE id = ? AND user_id = ?'),

  // App data queries
  getAppData: db.prepare('SELECT * FROM app_data WHERE app_id = ? ORDER BY created_at DESC'),
  getAppDataById: db.prepare('SELECT * FROM app_data WHERE id = ? AND app_id = ?'),
  createAppData: db.prepare(`
    INSERT INTO app_data (app_id, data, created_at) 
    VALUES (?, ?, datetime('now'))
  `),
  updateAppData: db.prepare(`
    UPDATE app_data 
    SET data = ?, updated_at = datetime('now') 
    WHERE id = ? AND app_id = ?
  `),
  deleteAppData: db.prepare('DELETE FROM app_data WHERE id = ? AND app_id = ?'),
  clearAppData: db.prepare('DELETE FROM app_data WHERE app_id = ?'),
};

// Simple helper functions for CRUD operations
export const userHelpers = {
  getById: (id: number) => queries.getUserById.get(id),
  getByEmail: (email: string) => queries.getUserByEmail.get(email),
  create: (email: string, name: string) => queries.createUser.run(email, name),
  update: (id: number, name: string) => queries.updateUser.run(name, id),
  delete: (id: number) => queries.deleteUser.run(id),
};

export const appHelpers = {
  getById: (id: number) => queries.getAppById.get(id),
  getUserApps: (userId: number) => queries.getUserApps.all(userId),
  create: (name: string, spec: string, userId: number) => queries.createApp.run(name, spec, userId),
  update: (id: number, userId: number, name: string, spec: string) => 
    queries.updateApp.run(name, spec, id, userId),
  delete: (id: number, userId: number) => queries.deleteApp.run(id, userId),
};

export const appDataHelpers = {
  getByAppId: (appId: number) => queries.getAppData.all(appId),
  getById: (id: number, appId: number) => queries.getAppDataById.get(id, appId),
  create: (appId: number, data: string) => queries.createAppData.run(appId, data),
  update: (id: number, appId: number, data: string) => 
    queries.updateAppData.run(data, id, appId),
  delete: (id: number, appId: number) => queries.deleteAppData.run(id, appId),
  clearAll: (appId: number) => queries.clearAppData.run(appId),
};

// Simple transaction helper (using better-sqlite3's built-in transaction support)
export const transaction = db.transaction;

// Graceful shutdown
export const closeDatabase = () => {
  db.close();
};

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