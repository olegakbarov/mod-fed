// Simple test for the simplified generator
import { SimpleAIGenerator } from './src/generators/simple-generator';

async function testGenerator() {
  console.log('Testing Simplified AI Generator...\n');
  
  const generator = new SimpleAIGenerator();
  
  const testCases = [
    'Create a todo list app',
    'Build a dashboard with analytics',
    'Make a blog reader app',
    'Design a simple app'
  ];
  
  for (const testCase of testCases) {
    try {
      console.log(`Testing: "${testCase}"`);
      const result = await generator.generateApp(testCase);
      
      console.log(`✅ Generated: ${result.appName}`);
      console.log(`   Screens: ${result.screens.length}`);
      console.log(`   Components in first screen: ${result.screens[0]?.components.length || 0}`);
      console.log(`   Database enabled: ${result.enableDatabase || false}`);
      console.log('');
      
    } catch (error) {
      console.error(`❌ Error generating app for "${testCase}":`, error);
      console.log('');
    }
  }
  
  console.log('Test completed!');
}

testGenerator().catch(console.error);