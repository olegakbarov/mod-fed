import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { simpleDB, userHelpers, appHelpers, appDataHelpers } from '../database-simple';
import fs from 'fs';
import path from 'path';

describe('Simple Database Layer', () => {
  const testDbPath = path.join(process.cwd(), 'test.db');
  
  beforeAll(async () => {
    // Initialize the database
    await simpleDB.initialize();
  });

  afterAll(() => {
    simpleDB.close();
  });

  beforeEach(() => {
    // Clear all data before each test - access the internal db for cleanup
    const db = (simpleDB as any).db;
    db.exec('DELETE FROM app_data');
    db.exec('DELETE FROM apps');
    db.exec('DELETE FROM users');
  });

  describe('User operations', () => {
    test('should create and retrieve a user', () => {
      const result = userHelpers.create('test@example.com', 'Test User');
      expect(result.lastInsertRowid).toBeDefined();
      
      const userId = result.lastInsertRowid as number;
      const user = userHelpers.getById(userId);
      
      expect(user).toBeDefined();
      expect(user?.email).toBe('test@example.com');
      expect(user?.name).toBe('Test User');
    });

    test('should find user by email', () => {
      userHelpers.create('find@example.com', 'Find User');
      const user = userHelpers.getByEmail('find@example.com');
      
      expect(user).toBeDefined();
      expect(user?.name).toBe('Find User');
    });

    test('should update user', () => {
      const result = userHelpers.create('update@example.com', 'Original Name');
      const userId = result.lastInsertRowid as number;
      
      userHelpers.update(userId, 'Updated Name');
      const user = userHelpers.getById(userId);
      
      expect(user?.name).toBe('Updated Name');
    });

    test('should delete user', () => {
      const result = userHelpers.create('delete@example.com', 'Delete User');
      const userId = result.lastInsertRowid as number;
      
      userHelpers.delete(userId);
      const user = userHelpers.getById(userId);
      
      expect(user).toBeUndefined();
    });
  });

  describe('App operations', () => {
    let userId: number;

    beforeEach(() => {
      const result = userHelpers.create('app@example.com', 'App User');
      userId = result.lastInsertRowid as number;
    });

    test('should create and retrieve an app', () => {
      const spec = JSON.stringify({ type: 'todo' });
      const result = appHelpers.create('Test App', spec, userId);
      const appId = result.lastInsertRowid as number;
      
      const app = appHelpers.getById(appId);
      expect(app).toBeDefined();
      expect(app?.name).toBe('Test App');
      expect(app?.spec).toBe(spec);
      expect(app?.user_id).toBe(userId);
    });

    test('should get user apps', () => {
      appHelpers.create('App 1', '{"type":"todo"}', userId);
      appHelpers.create('App 2', '{"type":"blog"}', userId);
      
      const userApps = appHelpers.getUserApps(userId);
      expect(userApps).toHaveLength(2);
      
      // Verify both apps are present (order may vary in fast tests)
      const appNames = userApps.map(app => app.name).sort();
      expect(appNames).toEqual(['App 1', 'App 2']);
    });

    test('should update app', () => {
      const result = appHelpers.create('Original App', '{"type":"todo"}', userId);
      const appId = result.lastInsertRowid as number;
      
      appHelpers.update(appId, userId, 'Updated App', '{"type":"updated"}');
      const app = appHelpers.getById(appId);
      
      expect(app?.name).toBe('Updated App');
      expect(app?.spec).toBe('{"type":"updated"}');
    });

    test('should delete app', () => {
      const result = appHelpers.create('Delete App', '{"type":"delete"}', userId);
      const appId = result.lastInsertRowid as number;
      
      appHelpers.delete(appId, userId);
      const app = appHelpers.getById(appId);
      
      expect(app).toBeUndefined();
    });
  });

  describe('App data operations', () => {
    let userId: number;
    let appId: number;

    beforeEach(() => {
      const userResult = userHelpers.create('data@example.com', 'Data User');
      userId = userResult.lastInsertRowid as number;
      
      const appResult = appHelpers.create('Data App', '{"type":"data"}', userId);
      appId = appResult.lastInsertRowid as number;
    });

    test('should create and retrieve app data', () => {
      const data = JSON.stringify({ items: ['item1', 'item2'] });
      const result = appDataHelpers.create(appId, data);
      const dataId = result.lastInsertRowid as number;
      
      const appData = appDataHelpers.getById(dataId, appId);
      expect(appData).toBeDefined();
      expect(appData?.data).toBe(data);
    });

    test('should get all app data for an app', () => {
      appDataHelpers.create(appId, '{"data":1}');
      appDataHelpers.create(appId, '{"data":2}');
      
      const allData = appDataHelpers.getByAppId(appId);
      expect(allData).toHaveLength(2);
    });

    test('should update app data', () => {
      const result = appDataHelpers.create(appId, '{"original":"data"}');
      const dataId = result.lastInsertRowid as number;
      
      appDataHelpers.update(dataId, appId, '{"updated":"data"}');
      const appData = appDataHelpers.getById(dataId, appId);
      
      expect(appData?.data).toBe('{"updated":"data"}');
    });

    test('should delete app data', () => {
      const result = appDataHelpers.create(appId, '{"delete":"data"}');
      const dataId = result.lastInsertRowid as number;
      
      appDataHelpers.delete(dataId, appId);
      const appData = appDataHelpers.getById(dataId, appId);
      
      expect(appData).toBeUndefined();
    });

    test('should clear all app data', () => {
      appDataHelpers.create(appId, '{"data":1}');
      appDataHelpers.create(appId, '{"data":2}');
      
      appDataHelpers.clearAll(appId);
      const allData = appDataHelpers.getByAppId(appId);
      
      expect(allData).toHaveLength(0);
    });
  });

  describe('Using the database directly', () => {
    test('should work with direct queries', () => {
      // Create user using helpers
      const result = userHelpers.create('query@example.com', 'Query User');
      const userId = result.lastInsertRowid as number;
      
      // Get user
      const user = userHelpers.getById(userId);
      expect(user?.email).toBe('query@example.com');
      
      // Create app
      const appResult = appHelpers.create('Query App', '{"type":"query"}', userId);
      const appId = appResult.lastInsertRowid as number;
      
      // Get app
      const app = appHelpers.getById(appId);
      expect(app?.name).toBe('Query App');
    });
  });
});