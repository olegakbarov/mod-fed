import { simpleDB, userHelpers, appHelpers, appDataHelpers } from './database-simple';

// Simple example showing how to use the database layer
export async function demonstrateDatabase() {
  console.log('=== Simple Database Layer Demo ===\n');

  // Initialize the database
  console.log('1. Initializing database...');
  await simpleDB.initialize();
  console.log('   ✓ Database initialized with tables and indexes\n');

  // Create users
  console.log('2. Creating users...');
  const user1 = userHelpers.create('alice@example.com', 'Alice Johnson');
  const user2 = userHelpers.create('bob@example.com', 'Bob Smith');
  console.log(`   ✓ Created user Alice with ID: ${user1.lastInsertRowid}`);
  console.log(`   ✓ Created user Bob with ID: ${user2.lastInsertRowid}\n`);

  const aliceId = user1.lastInsertRowid as number;
  const bobId = user2.lastInsertRowid as number;

  // Create apps for users
  console.log('3. Creating apps...');
  const todoApp = appHelpers.create('Todo App', JSON.stringify({
    type: 'todo',
    features: ['create', 'edit', 'delete', 'mark_complete'],
    theme: 'blue'
  }), aliceId);

  const blogApp = appHelpers.create('Personal Blog', JSON.stringify({
    type: 'blog',
    features: ['posts', 'comments', 'categories'],
    theme: 'dark'
  }), aliceId);

  const dashboardApp = appHelpers.create('Analytics Dashboard', JSON.stringify({
    type: 'dashboard',
    widgets: ['charts', 'metrics', 'notifications'],
    refreshInterval: 30000
  }), bobId);

  console.log(`   ✓ Created Todo App with ID: ${todoApp.lastInsertRowid}`);
  console.log(`   ✓ Created Blog App with ID: ${blogApp.lastInsertRowid}`);
  console.log(`   ✓ Created Dashboard App with ID: ${dashboardApp.lastInsertRowid}\n`);

  // Add some data to the apps
  console.log('4. Adding app data...');
  const todoAppId = todoApp.lastInsertRowid as number;
  const blogAppId = blogApp.lastInsertRowid as number;

  appDataHelpers.create(todoAppId, JSON.stringify({
    todos: [
      { id: 1, text: 'Buy groceries', completed: false },
      { id: 2, text: 'Walk the dog', completed: true },
      { id: 3, text: 'Finish project', completed: false }
    ]
  }));

  appDataHelpers.create(blogAppId, JSON.stringify({
    posts: [
      {
        id: 1,
        title: 'My First Blog Post',
        content: 'Welcome to my new blog!',
        published: true,
        publishedAt: new Date().toISOString()
      }
    ],
    settings: {
      commentsEnabled: true,
      moderationRequired: false
    }
  }));

  console.log('   ✓ Added data to Todo App');
  console.log('   ✓ Added data to Blog App\n');

  // Query and display data
  console.log('5. Querying data...');
  
  // Get user with their apps
  const alice = userHelpers.getById(aliceId);
  const aliceApps = appHelpers.getUserApps(aliceId);
  console.log(`   User: ${alice?.name} (${alice?.email})`);
  console.log(`   Apps: ${aliceApps.map(app => app.name).join(', ')}\n`);

  // Get app data
  const todoData = appDataHelpers.getByAppId(todoAppId);
  if (todoData.length > 0) {
    const parsedTodoData = JSON.parse(todoData[0].data);
    console.log(`   Todo App has ${parsedTodoData.todos.length} todos`);
    parsedTodoData.todos.forEach((todo: any) => {
      console.log(`   - ${todo.text} ${todo.completed ? '✓' : '○'}`);
    });
  }
  console.log();

  // Demonstrate transaction usage
  console.log('6. Using transactions...');
  const createUserWithApp = simpleDB.transaction((email: string, name: string, appName: string) => {
    const userResult = userHelpers.create(email, name);
    const userId = userResult.lastInsertRowid as number;
    
    const appResult = appHelpers.create(appName, JSON.stringify({ type: 'simple' }), userId);
    
    return {
      userId,
      appId: appResult.lastInsertRowid as number
    };
  });

  const transactionResult = createUserWithApp('charlie@example.com', 'Charlie Brown', 'Simple App');
  console.log(`   ✓ Transaction completed: User ${transactionResult.userId}, App ${transactionResult.appId}\n`);

  // Update some data
  console.log('7. Updating data...');
  userHelpers.update(aliceId, 'Alice Johnson-Smith');
  appHelpers.update(todoAppId, aliceId, 'My Personal Todo List', JSON.stringify({
    type: 'todo',
    features: ['create', 'edit', 'delete', 'mark_complete', 'categories'],
    theme: 'green'
  }));
  console.log('   ✓ Updated user name and app details\n');

  // Clean up
  console.log('8. Cleanup...');
  console.log('   Note: In production, you might want to keep this data!');
  console.log('   For demo purposes, we\'re not deleting the created data.\n');

  console.log('=== Demo Complete ===');
  console.log('Database file created at: app.db');
  console.log('Use any SQLite browser to inspect the data structure.');
}

// Export individual functions for more specific use cases
export async function quickStart() {
  // Initialize database
  await simpleDB.initialize();
  
  // Create a user
  const user = userHelpers.create('user@example.com', 'Example User');
  const userId = user.lastInsertRowid as number;
  
  // Create an app
  const app = appHelpers.create('My App', JSON.stringify({ type: 'example' }), userId);
  const appId = app.lastInsertRowid as number;
  
  // Add some data
  appDataHelpers.create(appId, JSON.stringify({ message: 'Hello World!' }));
  
  return { userId, appId };
}

// Run the demo if this file is executed directly
if (import.meta.main) {
  demonstrateDatabase().catch(console.error);
}