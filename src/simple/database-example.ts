import { db, queries, userHelpers, appHelpers, appDataHelpers, transaction } from './database';
import { runMigrations } from './migrations';

// Example implementation showing how to use the simple database layer
export class DatabaseExample {
  
  // Initialize database and run migrations
  async initialize() {
    console.log('Running database migrations...');
    await runMigrations();
    console.log('Database initialized successfully');
  }

  // Example: Create a user and some apps
  async createUserWithApps() {
    try {
      // Create a user
      const userResult = userHelpers.create('john@example.com', 'John Doe');
      const userId = userResult.lastInsertRowid as number;
      
      console.log(`Created user with ID: ${userId}`);

      // Create some apps for the user
      const app1 = appHelpers.create('Todo App', JSON.stringify({
        type: 'todo',
        features: ['create', 'edit', 'delete', 'mark_complete']
      }), userId);

      const app2 = appHelpers.create('Dashboard', JSON.stringify({
        type: 'dashboard',
        widgets: ['charts', 'metrics', 'notifications']
      }), userId);

      console.log(`Created apps with IDs: ${app1.lastInsertRowid}, ${app2.lastInsertRowid}`);

      return { userId, appIds: [app1.lastInsertRowid as number, app2.lastInsertRowid as number] };
    } catch (error) {
      console.error('Error creating user with apps:', error);
      throw error;
    }
  }

  // Example: Use transactions for complex operations
  async createUserAndAppsTransaction() {
    const createUserAndApps = transaction((email: string, name: string, appSpecs: Array<{name: string, spec: any}>) => {
      // Create user
      const userResult = queries.createUser.run(email, name);
      const userId = userResult.lastInsertRowid as number;

      // Create apps
      const appIds: number[] = [];
      for (const appSpec of appSpecs) {
        const appResult = queries.createApp.run(appSpec.name, JSON.stringify(appSpec.spec), userId);
        appIds.push(appResult.lastInsertRowid as number);
      }

      return { userId, appIds };
    });

    try {
      const result = createUserAndApps('jane@example.com', 'Jane Smith', [
        {
          name: 'Blog App',
          spec: { type: 'blog', features: ['posts', 'comments', 'categories'] }
        },
        {
          name: 'E-commerce',
          spec: { type: 'ecommerce', features: ['products', 'cart', 'checkout'] }
        }
      ]);

      console.log('Transaction completed successfully:', result);
      return result;
    } catch (error) {
      console.error('Transaction failed:', error);
      throw error;
    }
  }

  // Example: Query data with various methods
  async queryExamples() {
    // Get user by ID
    const user = userHelpers.getById(1);
    console.log('User by ID:', user);

    // Get user by email
    const userByEmail = userHelpers.getByEmail('john@example.com');
    console.log('User by email:', userByEmail);

    // Get all apps for a user
    const userApps = appHelpers.getUserApps(1);
    console.log('User apps:', userApps);

    // Get app with user details (using prepared statement)
    const appWithUser = queries.getAppWithUser.get(1);
    console.log('App with user details:', appWithUser);

    // Add some app data
    const appId = 1;
    appDataHelpers.create(appId, JSON.stringify({ todos: ['Buy milk', 'Walk dog'] }));
    appDataHelpers.create(appId, JSON.stringify({ todos: ['Buy milk', 'Walk dog', 'Do laundry'] }));

    // Get app data
    const appData = appDataHelpers.getByAppId(appId);
    console.log('App data:', appData);
  }

  // Example: Clean up
  async cleanup() {
    // Delete some test data
    appDataHelpers.clearAll(1);
    appHelpers.delete(1, 1);
    userHelpers.delete(1);
    
    console.log('Cleanup completed');
  }
}

// Example usage
async function runExample() {
  const example = new DatabaseExample();
  
  try {
    await example.initialize();
    await example.createUserWithApps();
    await example.createUserAndAppsTransaction();
    await example.queryExamples();
    // await example.cleanup(); // Uncomment to clean up test data
  } catch (error) {
    console.error('Example failed:', error);
  }
}

// Export the example for use
export { runExample };