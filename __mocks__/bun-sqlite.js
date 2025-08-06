// Mock for Bun SQLite
class MockDatabase {
  constructor(path, options = {}) {
    this.path = path;
    this.options = options;
    this.data = new Map();
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
    const mockData = {
      id: this.lastInsertRowid,
      name: 'Test App',
      spec: '{"appName":"Test"}',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return {
      get: jest.fn(() => mockData),
      all: jest.fn(() => [mockData]),
    };
  }

  prepare(query) {
    return {
      run: (...params) => this.run(query, ...params),
      get: jest.fn(() => ({})),
      all: jest.fn(() => []),
    };
  }

  close() {
    return true;
  }
}

module.exports = {
  Database: MockDatabase,
};