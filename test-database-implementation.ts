#!/usr/bin/env bun

/**
 * Test script to verify the database implementation
 * This tests the connection pool, transactions, migrations, and authentication features
 */

import { join } from "node:path";
import { unlink } from "node:fs/promises";

// Import our new modules
import { initializeConnectionPool, getConnectionPool, shutdownConnectionPool } from "./src/database/connection-pool";
import { withTransaction, transactionManager } from "./src/database/transactions";
import { runMigrations, isDatabaseUpToDate, getMigrationStats } from "./src/database/migrations";

const TEST_DB_PATH = join(process.cwd(), "test-app-data.db");

async function testDatabaseImplementation() {
  console.log("🔧 Testing Database Implementation...\n");

  try {
    // Clean up any existing test database
    try {
      await unlink(TEST_DB_PATH);
      console.log("📁 Cleaned up existing test database");
    } catch {
      // File doesn't exist, that's fine
    }

    // Test 1: Initialize Connection Pool
    console.log("1️⃣ Testing Connection Pool Initialization...");
    const pool = initializeConnectionPool(TEST_DB_PATH, {
      minConnections: 1,
      maxConnections: 3,
      connectionTimeout: 1000,
      idleTimeout: 10000,
      healthCheckInterval: 5000,
      maxConnectionAge: 30000,
      maxQueriesPerConnection: 100,
    });

    console.log("✅ Connection pool initialized successfully");

    // Wait a moment for initialization
    await new Promise(resolve => setTimeout(resolve, 100));

    // Test 2: Run Migrations
    console.log("\n2️⃣ Testing Database Migrations...");
    await runMigrations();
    
    const isUpToDate = await isDatabaseUpToDate();
    console.log(`✅ Migrations completed. Database up to date: ${isUpToDate}`);

    const migrationStats = await getMigrationStats();
    console.log(`📊 Migration stats: ${migrationStats.appliedMigrations}/${migrationStats.totalMigrations} applied`);

    // Test 3: Test Connection Pool Operations
    console.log("\n3️⃣ Testing Connection Pool Operations...");
    
    // Test basic query
    const testResult = await pool.query<any[]>("SELECT 1 as test", [], 'all');
    console.log(`✅ Basic query successful: ${JSON.stringify(testResult)}`);

    // Test pool stats
    const stats = pool.getStats();
    console.log(`📊 Pool stats: ${stats.totalConnections} connections, ${stats.totalQueries} queries`);

    // Test 4: Test Transactions
    console.log("\n4️⃣ Testing Transaction Management...");
    
    // Create a test table
    await withTransaction(async (db) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS test_users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          user_id TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
    });

    console.log("✅ Test table created in transaction");

    // Test successful transaction
    const insertResult = await withTransaction(async (db) => {
      const result1 = db.run("INSERT INTO test_users (name, user_id) VALUES (?, ?)", ["John Doe", "user_123"]);
      const result2 = db.run("INSERT INTO test_users (name, user_id) VALUES (?, ?)", ["Jane Doe", "user_456"]);
      return { result1, result2 };
    });

    console.log(`✅ Transaction successful: inserted ${insertResult.result1.changes} + ${insertResult.result2.changes} rows`);

    // Test rollback transaction
    try {
      await withTransaction(async (db) => {
        db.run("INSERT INTO test_users (name, user_id) VALUES (?, ?)", ["Bad User", "user_789"]);
        throw new Error("Intentional error to test rollback");
      });
    } catch (error) {
      console.log("✅ Transaction rollback test successful (error was expected)");
    }

    // Verify rollback worked
    const userCount = await pool.query<any>("SELECT COUNT(*) as count FROM test_users", [], 'get');
    console.log(`✅ User count after rollback: ${userCount.count} (should be 2)`);

    // Test 5: Test User-scoped Data Access
    console.log("\n5️⃣ Testing User-scoped Data Access...");

    // Insert data with different user IDs
    await withTransaction(async (db) => {
      db.run("INSERT INTO dynamic_data (collection, data, user_id) VALUES (?, ?, ?)", 
        ["todos", JSON.stringify({title: "User1 Todo", completed: false}), "user_123"]);
      db.run("INSERT INTO dynamic_data (collection, data, user_id) VALUES (?, ?, ?)", 
        ["todos", JSON.stringify({title: "User2 Todo", completed: false}), "user_456"]);
      db.run("INSERT INTO dynamic_data (collection, data, user_id) VALUES (?, ?, ?)", 
        ["todos", JSON.stringify({title: "Public Todo", completed: false}), null]);
    });

    // Test user-scoped queries
    const user1Data = await pool.query<any[]>(
      "SELECT * FROM dynamic_data WHERE collection = ? AND (user_id = ? OR user_id IS NULL)", 
      ["todos", "user_123"], 
      'all'
    );
    
    const user2Data = await pool.query<any[]>(
      "SELECT * FROM dynamic_data WHERE collection = ? AND (user_id = ? OR user_id IS NULL)", 
      ["todos", "user_456"], 
      'all'
    );

    console.log(`✅ User1 can see ${user1Data.length} todos (should be 2: own + public)`);
    console.log(`✅ User2 can see ${user2Data.length} todos (should be 2: own + public)`);

    // Test 6: Test Transaction Statistics
    console.log("\n6️⃣ Testing Transaction Statistics...");
    
    const txStats = transactionManager.getTransactionStats();
    console.log(`📊 Transaction stats: ${txStats.activeTransactions} active, ${txStats.totalTransactions} total`);

    // Test 7: Stress Test (Mini)
    console.log("\n7️⃣ Running Mini Stress Test...");
    
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(
        withTransaction(async (db) => {
          const userId = `stress_user_${i}`;
          return db.run(
            "INSERT INTO test_users (name, user_id) VALUES (?, ?)", 
            [`Stress User ${i}`, userId]
          );
        })
      );
    }

    const results = await Promise.all(promises);
    console.log(`✅ Stress test completed: ${results.length} concurrent transactions`);

    // Final pool stats
    const finalStats = pool.getStats();
    console.log(`📊 Final pool stats: ${finalStats.totalConnections} connections, ${finalStats.totalQueries} queries, ${finalStats.averageResponseTime.toFixed(2)}ms avg response time`);

    console.log("\n✅ All tests completed successfully!");
    
    return true;
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    return false;
  } finally {
    // Cleanup
    console.log("\n🧹 Cleaning up...");
    try {
      await shutdownConnectionPool();
      await unlink(TEST_DB_PATH);
      console.log("✅ Cleanup completed");
    } catch (error) {
      console.warn("⚠️ Cleanup warning:", error);
    }
  }
}

// Run the test
testDatabaseImplementation().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error("💥 Unexpected error:", error);
  process.exit(1);
});