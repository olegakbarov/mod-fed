// Basic test to verify the simple database works
import { SimpleDatabase } from './database-simple';

async function basicTest() {
  console.log('=== Basic Database Test ===');
  
  const db = new SimpleDatabase(':memory:'); // Use in-memory database for testing
  
  try {
    // Initialize
    console.log('1. Initializing database...');
    await db.initialize();
    console.log('   ✓ Database initialized');

    // Test user operations
    console.log('2. Testing user operations...');
    const userResult = db.userHelpers.create('test@example.com', 'Test User');
    const userId = userResult.lastInsertRowid as number;
    console.log(`   ✓ Created user with ID: ${userId}`);

    const user = db.userHelpers.getById(userId);
    console.log(`   ✓ Retrieved user: ${user?.name} (${user?.email})`);

    // Test app operations
    console.log('3. Testing app operations...');
    const appResult = db.appHelpers.create('Test App', JSON.stringify({ type: 'test' }), userId);
    const appId = appResult.lastInsertRowid as number;
    console.log(`   ✓ Created app with ID: ${appId}`);

    const app = db.appHelpers.getById(appId);
    console.log(`   ✓ Retrieved app: ${app?.name}`);

    // Test app data operations
    console.log('4. Testing app data operations...');
    const dataResult = db.appDataHelpers.create(appId, JSON.stringify({ message: 'Hello World' }));
    const dataId = dataResult.lastInsertRowid as number;
    console.log(`   ✓ Created app data with ID: ${dataId}`);

    const appData = db.appDataHelpers.getById(dataId, appId);
    console.log(`   ✓ Retrieved app data: ${appData?.data}`);

    // Test transaction
    console.log('5. Testing transaction...');
    const createUserAndApp = db.transaction((email: string, name: string) => {
      const userRes = db.userHelpers.create(email, name);
      const newUserId = userRes.lastInsertRowid as number;
      const appRes = db.appHelpers.create('Transaction App', '{"type":"transaction"}', newUserId);
      return { userId: newUserId, appId: appRes.lastInsertRowid as number };
    });

    const txResult = createUserAndApp('tx@example.com', 'Transaction User');
    console.log(`   ✓ Transaction completed: User ${txResult.userId}, App ${txResult.appId}`);

    console.log('\n=== All tests passed! ===');
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    db.close();
  }
}

// Run the test
basicTest().catch(console.error);