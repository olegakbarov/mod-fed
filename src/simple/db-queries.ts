import { db } from './database';
import type { Database } from 'better-sqlite3';

// Type definitions for our data models
export interface User {
  id: number;
  email: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface App {
  id: number;
  name: string;
  spec: string;
  user_id: number;
  created_at: string;
  updated_at: string;
}

export interface AppData {
  id: number;
  app_id: number;
  data: string;
  created_at: string;
  updated_at?: string;
}

// Prepared statements for all common queries
export class DatabaseQueries {
  private db: Database;

  constructor(database: Database) {
    this.db = database;
  }

  // User queries
  getUserById = this.db.prepare('SELECT * FROM users WHERE id = ?');
  getUserByEmail = this.db.prepare('SELECT * FROM users WHERE email = ?');
  getAllUsers = this.db.prepare('SELECT * FROM users ORDER BY created_at DESC');
  
  createUser = this.db.prepare(`
    INSERT INTO users (email, name, created_at, updated_at) 
    VALUES (?, ?, datetime('now'), datetime('now'))
  `);
  
  updateUser = this.db.prepare(`
    UPDATE users 
    SET name = ?, updated_at = datetime('now') 
    WHERE id = ?
  `);
  
  deleteUser = this.db.prepare('DELETE FROM users WHERE id = ?');

  // App queries
  getAppById = this.db.prepare('SELECT * FROM apps WHERE id = ?');
  getUserApps = this.db.prepare('SELECT * FROM apps WHERE user_id = ? ORDER BY created_at DESC');
  getAllApps = this.db.prepare('SELECT * FROM apps ORDER BY created_at DESC');
  
  createApp = this.db.prepare(`
    INSERT INTO apps (name, spec, user_id, created_at, updated_at) 
    VALUES (?, ?, ?, datetime('now'), datetime('now'))
  `);
  
  updateApp = this.db.prepare(`
    UPDATE apps 
    SET name = ?, spec = ?, updated_at = datetime('now') 
    WHERE id = ? AND user_id = ?
  `);
  
  deleteApp = this.db.prepare('DELETE FROM apps WHERE id = ? AND user_id = ?');

  // App data queries
  getAppData = this.db.prepare('SELECT * FROM app_data WHERE app_id = ? ORDER BY created_at DESC');
  getAppDataById = this.db.prepare('SELECT * FROM app_data WHERE id = ? AND app_id = ?');
  
  createAppData = this.db.prepare(`
    INSERT INTO app_data (app_id, data, created_at) 
    VALUES (?, ?, datetime('now'))
  `);
  
  updateAppData = this.db.prepare(`
    UPDATE app_data 
    SET data = ?, updated_at = datetime('now') 
    WHERE id = ? AND app_id = ?
  `);
  
  deleteAppData = this.db.prepare('DELETE FROM app_data WHERE id = ? AND app_id = ?');
  clearAppData = this.db.prepare('DELETE FROM app_data WHERE app_id = ?');

  // Complex queries with joins
  getAppWithUser = this.db.prepare(`
    SELECT 
      apps.*,
      users.email as user_email,
      users.name as user_name
    FROM apps 
    JOIN users ON apps.user_id = users.id 
    WHERE apps.id = ?
  `);

  getUserWithAppsCount = this.db.prepare(`
    SELECT 
      users.*,
      COUNT(apps.id) as app_count
    FROM users 
    LEFT JOIN apps ON users.id = apps.user_id 
    WHERE users.id = ?
    GROUP BY users.id
  `);

  // Helper methods with proper typing
  user = {
    getById: (id: number): User | undefined => this.getUserById.get(id) as User | undefined,
    getByEmail: (email: string): User | undefined => this.getUserByEmail.get(email) as User | undefined,
    getAll: (): User[] => this.getAllUsers.all() as User[],
    create: (email: string, name: string) => this.createUser.run(email, name),
    update: (id: number, name: string) => this.updateUser.run(name, id),
    delete: (id: number) => this.deleteUser.run(id),
  };

  app = {
    getById: (id: number): App | undefined => this.getAppById.get(id) as App | undefined,
    getUserApps: (userId: number): App[] => this.getUserApps.all(userId) as App[],
    getAll: (): App[] => this.getAllApps.all() as App[],
    create: (name: string, spec: string, userId: number) => this.createApp.run(name, spec, userId),
    update: (id: number, userId: number, name: string, spec: string) => 
      this.updateApp.run(name, spec, id, userId),
    delete: (id: number, userId: number) => this.deleteApp.run(id, userId),
    getWithUser: (id: number) => this.getAppWithUser.get(id),
  };

  appData = {
    getByAppId: (appId: number): AppData[] => this.getAppData.all(appId) as AppData[],
    getById: (id: number, appId: number): AppData | undefined => 
      this.getAppDataById.get(id, appId) as AppData | undefined,
    create: (appId: number, data: string) => this.createAppData.run(appId, data),
    update: (id: number, appId: number, data: string) => this.updateAppData.run(data, id, appId),
    delete: (id: number, appId: number) => this.deleteAppData.run(id, appId),
    clearAll: (appId: number) => this.clearAppData.run(appId),
  };
}

// Create and export default queries instance
export const queries = new DatabaseQueries(db);