# Simple Database Integration Guide

This guide shows how to integrate the simple database layer into your AI App Generator project.

## Runtime Compatibility

**Important**: Due to native module compilation differences, better-sqlite3 currently has compatibility issues with Bun runtime. Use Node.js for database operations.

- ✅ **Node.js**: Fully compatible
- ⚠️ **Bun**: Native module compatibility issues with better-sqlite3

## Installation

The required dependencies are already installed:
- `better-sqlite3`: SQLite database library
- `@types/better-sqlite3`: TypeScript definitions

## Integration Steps

### 1. Import and Initialize

```typescript
import { SimpleDatabase } from './src/simple/database-simple';

// Create database instance
const db = new SimpleDatabase('./app-data.db');

// Initialize (creates tables if they don't exist)
await db.initialize();
```

### 2. Basic CRUD Operations

```typescript
// Create a user
const userResult = db.userHelpers.create('user@example.com', 'User Name');
const userId = userResult.lastInsertRowid as number;

// Create an app for the user
const appResult = db.appHelpers.create(
  'My Todo App',
  JSON.stringify({ type: 'todo', theme: 'blue' }),
  userId
);
const appId = appResult.lastInsertRowid as number;

// Store app-specific data
db.appDataHelpers.create(
  appId,
  JSON.stringify({ todos: [{ text: 'Buy milk', done: false }] })
);
```

### 3. Querying Data

```typescript
// Get user and their apps
const user = db.userHelpers.getById(userId);
const userApps = db.appHelpers.getUserApps(userId);

// Get app data
const appData = db.appDataHelpers.getByAppId(appId);
```

### 4. Using Transactions

```typescript
// Create a transaction for atomic operations
const createUserWithApp = db.transaction((email: string, name: string, appName: string) => {
  const userRes = db.userHelpers.create(email, name);
  const userId = userRes.lastInsertRowid as number;
  
  const appRes = db.appHelpers.create(appName, '{"type":"new"}', userId);
  
  return { userId, appId: appRes.lastInsertRowid as number };
});

// Execute the transaction
const result = createUserWithApp('new@example.com', 'New User', 'New App');
```

## Replacing Complex Database Implementation

If you're replacing an existing complex database implementation:

### Before (Complex)
```typescript
// Multiple files with custom pooling, complex transactions, etc.
import { DatabasePool } from './database/connection-pool';
import { TransactionManager } from './database/transactions';
import { MigrationRunner } from './database/migrations';

const pool = new DatabasePool(config);
const txManager = new TransactionManager(pool);
// ... complex setup
```

### After (Simple)
```typescript
// Single import and initialization
import { SimpleDatabase } from './src/simple/database-simple';

const db = new SimpleDatabase('./app.db');
await db.initialize();
// Ready to use!
```

## API Server Integration

For the API server (`server/api-server.ts`):

```typescript
import express from 'express';
import { SimpleDatabase } from '../src/simple/database-simple';

const app = express();
const db = new SimpleDatabase('./app-data.db');

// Initialize database on server startup
app.listen(3002, async () => {
  await db.initialize();
  console.log('Database initialized');
  console.log('API server running on port 3002');
});

// Example API endpoint
app.post('/api/users', async (req, res) => {
  try {
    const { email, name } = req.body;
    const result = db.userHelpers.create(email, name);
    res.json({ id: result.lastInsertRowid, email, name });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/users/:id/apps', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const apps = db.appHelpers.getUserApps(userId);
    res.json(apps);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
```

## Component Server Integration

For the component server (`server/component-server.ts`), you might want to track component usage:

```typescript
import { SimpleDatabase } from '../src/simple/database-simple';

const db = new SimpleDatabase('./component-usage.db');
await db.initialize();

// Track component loads
app.get('/components/:name', async (req, res) => {
  const componentName = req.params.name;
  
  // Serve the component file
  const componentPath = path.join(__dirname, '../remote-components', `${componentName}.js`);
  if (fs.existsSync(componentPath)) {
    // Log usage (optional)
    db.appDataHelpers.create(
      1, // Could be a system app ID
      JSON.stringify({
        event: 'component_loaded',
        component: componentName,
        timestamp: new Date().toISOString(),
        userAgent: req.get('User-Agent')
      })
    );
    
    res.type('application/javascript');
    res.sendFile(componentPath);
  } else {
    res.status(404).send('Component not found');
  }
});
```

## Migration from Existing Database Code

### 1. Remove Complex Files
Remove these if they exist:
- `src/database/connection-pool.ts`
- `src/database/transactions.ts`
- Custom migration runners (keep migration SQL files)

### 2. Update Imports
Replace:
```typescript
import { db } from './database/connection';
import { runInTransaction } from './database/transactions';
```

With:
```typescript
import { SimpleDatabase } from './src/simple/database-simple';
const db = new SimpleDatabase('./app.db');
```

### 3. Update Usage Patterns
Replace custom query builders with direct helper calls:
```typescript
// Before
const user = await db.query('SELECT * FROM users WHERE id = ?', [userId]);

// After
const user = db.userHelpers.getById(userId);
```

## Testing

Run the included tests to verify everything works:

```bash
# Run database tests (uses Node.js via Jest)
npm test -- src/simple/__tests__/database.test.ts

# Run basic functionality test (uses tsx/Node.js)
npx tsx src/simple/basic-test.ts
```

## Performance Considerations

The simple database is optimized for the AI App Generator's use case:
- WAL mode for concurrent reads
- Prepared statements for all queries
- Appropriate indexes on foreign keys and commonly queried columns
- Memory temp store for faster temporary operations

For production applications with high traffic, consider:
1. Regular database backups (simple file copy)
2. Monitoring database file size
3. Periodic VACUUM operations for maintenance
4. Connection monitoring (better-sqlite3 handles this automatically)

## Error Handling

Handle common SQLite errors:

```typescript
try {
  db.userHelpers.create('duplicate@example.com', 'Name');
} catch (error) {
  if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    console.log('User already exists');
  } else {
    console.error('Database error:', error);
  }
}
```

## Next Steps

1. Replace existing database calls with the simple helpers
2. Update API endpoints to use the new database interface
3. Remove complex database configuration files
4. Update tests to use the new database layer
5. Consider adding database backup automation for production