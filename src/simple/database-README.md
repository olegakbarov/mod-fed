# Simple Database Layer

A lightweight SQLite database layer built with better-sqlite3 for the AI App Generator project. This implementation focuses on simplicity and reliability, using better-sqlite3's built-in features without custom complexity.

## Features

- **Simple Setup**: Single initialization call sets up everything
- **WAL Mode**: Optimized for performance and concurrency
- **Prepared Statements**: All queries are pre-compiled for better performance
- **Type Safety**: Full TypeScript support with proper interfaces
- **Transaction Support**: Built-in transaction helper using better-sqlite3's native transactions
- **Helper Functions**: Convenient CRUD operations for common use cases
- **Auto-initialization**: Tables and indexes created automatically
- **Graceful Shutdown**: Proper cleanup on process termination

## Quick Start

```typescript
import { simpleDB, userHelpers, appHelpers, appDataHelpers } from './database-simple';

// Initialize the database
await simpleDB.initialize();

// Create a user
const userResult = userHelpers.create('user@example.com', 'John Doe');
const userId = userResult.lastInsertRowid as number;

// Create an app
const appResult = appHelpers.create('My App', JSON.stringify({ type: 'todo' }), userId);
const appId = appResult.lastInsertRowid as number;

// Add some app data
appDataHelpers.create(appId, JSON.stringify({ todos: ['Buy milk', 'Walk dog'] }));

// Query data
const user = userHelpers.getById(userId);
const userApps = appHelpers.getUserApps(userId);
const appData = appDataHelpers.getByAppId(appId);
```

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### Apps Table
```sql
CREATE TABLE apps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  spec TEXT NOT NULL,  -- JSON specification of the app
  user_id INTEGER NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### App Data Table
```sql
CREATE TABLE app_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id INTEGER NOT NULL,
  data TEXT NOT NULL,  -- JSON data for the app
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT NULL,
  FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE
);
```

## API Reference

### Initialization

```typescript
import { simpleDB } from './database-simple';

// Initialize database (creates tables, indexes, and prepared statements)
await simpleDB.initialize();
```

### User Operations

```typescript
import { userHelpers } from './database-simple';

// Create user
const result = userHelpers.create('email@example.com', 'User Name');
const userId = result.lastInsertRowid as number;

// Get user by ID
const user = userHelpers.getById(userId);

// Get user by email
const user = userHelpers.getByEmail('email@example.com');

// Update user
userHelpers.update(userId, 'New Name');

// Delete user
userHelpers.delete(userId);
```

### App Operations

```typescript
import { appHelpers } from './database-simple';

// Create app
const result = appHelpers.create('App Name', JSON.stringify({ type: 'todo' }), userId);
const appId = result.lastInsertRowid as number;

// Get app by ID
const app = appHelpers.getById(appId);

// Get all apps for a user
const userApps = appHelpers.getUserApps(userId);

// Update app
appHelpers.update(appId, userId, 'New Name', JSON.stringify({ type: 'updated' }));

// Delete app
appHelpers.delete(appId, userId);
```

### App Data Operations

```typescript
import { appDataHelpers } from './database-simple';

// Create app data
const result = appDataHelpers.create(appId, JSON.stringify({ key: 'value' }));
const dataId = result.lastInsertRowid as number;

// Get app data by ID
const data = appDataHelpers.getById(dataId, appId);

// Get all data for an app
const allData = appDataHelpers.getByAppId(appId);

// Update app data
appDataHelpers.update(dataId, appId, JSON.stringify({ updated: 'data' }));

// Delete specific app data
appDataHelpers.delete(dataId, appId);

// Clear all data for an app
appDataHelpers.clearAll(appId);
```

### Transactions

```typescript
import { simpleDB } from './database-simple';

// Create a transaction
const createUserAndApp = simpleDB.transaction((email: string, name: string, appName: string) => {
  const userResult = userHelpers.create(email, name);
  const userId = userResult.lastInsertRowid as number;
  
  const appResult = appHelpers.create(appName, JSON.stringify({ type: 'new' }), userId);
  
  return {
    userId,
    appId: appResult.lastInsertRowid as number
  };
});

// Execute the transaction
const result = createUserAndApp('user@example.com', 'User Name', 'App Name');
```

### Direct Query Access

For more advanced operations, you can access the prepared statements directly:

```typescript
import { simpleDB } from './database-simple';

// Access queries after initialization
await simpleDB.initialize();

const queries = simpleDB.queries;
const user = queries.getUserById.get(1);
const apps = queries.getUserApps.all(1);
```

## Configuration

The database is configured with optimized settings:
- **WAL Mode**: For better concurrency
- **Normal Synchronous**: Balanced performance and safety
- **Memory Temp Store**: Faster temporary operations
- **1000 Cache Size**: Optimized for small to medium datasets

## Error Handling

The database layer throws standard SQLite errors. Common patterns:

```typescript
try {
  const user = userHelpers.create('duplicate@example.com', 'Name');
} catch (error) {
  if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    console.error('User with this email already exists');
  }
}
```

## Testing

Run the test suite:

```bash
npm test -- src/simple/__tests__/database.test.ts
```

The tests cover all CRUD operations and demonstrate proper usage patterns.

## Performance Notes

- All queries are prepared statements for optimal performance
- Indexes are created on commonly queried columns
- WAL mode allows concurrent reads while writing
- Database file grows incrementally and can be backed up while running

## Production Considerations

1. **Database Location**: Configure database path for your deployment
2. **Backups**: Set up regular SQLite backups (simple file copy works with WAL mode)
3. **Monitoring**: Monitor database file size and query performance
4. **Maintenance**: Consider periodic VACUUM operations for long-running databases

## Migration from Complex Implementation

If migrating from a more complex database implementation:

1. Initialize the simple database: `await simpleDB.initialize()`
2. Use helper functions instead of custom query builders
3. Replace custom transaction logic with `simpleDB.transaction`
4. Remove custom connection pooling (better-sqlite3 handles this internally)
5. Simplify error handling to use standard SQLite errors

## Example Integration

See `simple-example.ts` for a comprehensive demonstration of all features.