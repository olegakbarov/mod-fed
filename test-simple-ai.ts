/**
 * Simple test script for the AI service with circuit breaker
 */

import { generateApp, getAIService } from './src/simple/ai-service';

async function demonstrateAIService() {
  console.log('🚀 Testing Simple AI Service with Circuit Breaker');
  console.log('═'.repeat(60));

  const aiService = getAIService();

  try {
    // Test 1: Normal operation (will fall back since no real API key)
    console.log('\n📝 Test 1: Generate a todo app');
    const todoApp = await generateApp('Create a todo list for managing daily tasks');
    console.log(`✅ Generated: ${todoApp.appName}`);
    console.log(`📱 Screens: ${todoApp.screens.length}`);
    console.log(`🗄️ Database: ${todoApp.enableDatabase ? 'enabled' : 'disabled'}`);

    // Test 2: Dashboard app
    console.log('\n📊 Test 2: Generate a dashboard app');
    const dashboardApp = await generateApp('Build an analytics dashboard for business metrics');
    console.log(`✅ Generated: ${dashboardApp.appName}`);
    console.log(`📱 Screens: ${dashboardApp.screens.length}`);

    // Test 3: Blog app
    console.log('\n📝 Test 3: Generate a blog app');
    const blogApp = await generateApp('Create a blog platform for writing articles');
    console.log(`✅ Generated: ${blogApp.appName}`);
    console.log(`🗄️ Database: ${blogApp.enableDatabase ? 'enabled' : 'disabled'}`);
    console.log(`📚 Collection: ${blogApp.dataCollection}`);

    // Test 4: Generic app
    console.log('\n🎮 Test 4: Generate a generic app');
    const genericApp = await generateApp('Make a fun game app');
    console.log(`✅ Generated: ${genericApp.appName}`);
    console.log(`📱 Screens: ${genericApp.screens.length}`);

    // Test 5: Circuit breaker stats
    console.log('\n📊 Circuit Breaker Statistics:');
    const stats = aiService.getStats();
    console.log(`  State: ${stats.isOpen ? '🔴 OPEN' : stats.isHalfOpen ? '🟡 HALF-OPEN' : '🟢 CLOSED'}`);
    console.log(`  Total requests: ${stats.fires}`);
    console.log(`  Successes: ${stats.successes}`);
    console.log(`  Failures: ${stats.failures}`);
    console.log(`  Rejects: ${stats.rejects}`);

    // Test 6: Force circuit breaker open
    console.log('\n🔴 Test 6: Force circuit breaker open');
    aiService.forceOpen();
    const fallbackApp = await generateApp('Create a shopping app');
    console.log(`✅ Fallback generated: ${fallbackApp.appName}`);
    
    const statsAfterOpen = aiService.getStats();
    console.log(`  Circuit state after forcing open: ${statsAfterOpen.isOpen ? '🔴 OPEN' : '🟢 CLOSED'}`);

    // Test 7: Error handling
    console.log('\n❌ Test 7: Error handling');
    try {
      await generateApp('');
    } catch (error) {
      console.log(`✅ Correctly caught error: ${error.message}`);
    }

    console.log('\n🎉 All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  }
}

// Run the demo
if (require.main === module) {
  demonstrateAIService()
    .then(() => {
      console.log('\n✨ Demo completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Demo failed:', error);
      process.exit(1);
    });
}