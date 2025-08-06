// Mock for Bun SQLite
class MockDatabase {
  constructor(path, options = {}) {
    this.path = path;
    this.options = options;
    this.data = {
      users: new Map(),
      apps: new Map(),
    };
    this.lastInsertRowid = 0;
    this.changes = 0;
  }

  run(query, ...params) {
    this.lastInsertRowid += 1;
    this.changes = 1;
    
    // Simulate INSERT operation
    if (query.includes('INSERT')) {
      return {
        lastInsertRowid: this.lastInsertRowid,
        changes: 1,
      };
    }
    
    // Simulate UPDATE/DELETE operations
    return {
      changes: this.changes,
    };
  }

  query(query) {
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      name: 'Test User:salt:hashedpassword',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const mockApp = {
      id: 1,
      name: 'Test App',
      spec: '{"appName":"Test Todo App"}',
      user_id: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return {
      get: jest.fn((email) => {
        if (query.includes('users') && query.includes('email')) {
          return email === 'test@example.com' ? mockUser : null;
        }
        if (query.includes('apps')) {
          return mockApp;
        }
        return null;
      }),
      all: jest.fn(() => {
        if (query.includes('apps')) {
          return [mockApp];
        }
        return [];
      }),
    };
  }

  prepare(query) {
    const self = this;
    return {
      run: function(...params) {
        self.lastInsertRowid += 1;
        return {
          lastInsertRowid: self.lastInsertRowid,
          changes: 1,
        };
      },
      get: function(...params) {
        // Mock specific queries based on the SQL
        if (query.includes('getUserById')) {
          return { id: 1, name: 'test' };
        }
        if (query.includes('getUserByEmail')) {
          const email = params[0];
          if (email === 'test@example.com') {
            return {
              id: 1,
              email: 'test@example.com',
              name: 'Test User:salt:hashedpassword',
            };
          }
          return null;
        }
        if (query.includes('getAppById')) {
          return {
            id: 1,
            name: 'Test App',
            spec: '{"appName":"Test"}',
            user_id: 1,
          };
        }
        return null;
      },
      all: function(...params) {
        if (query.includes('getUserApps')) {
          return [{
            id: 1,
            name: 'Test App',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }];
        }
        return [];
      },
    };
  }

  exec(query) {
    // Mock exec method for PRAGMA statements and other commands
    return true;
  }

  close() {
    return true;
  }
}

module.exports = {
  Database: MockDatabase,
};