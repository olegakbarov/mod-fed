#!/usr/bin/env bun

import { DynamicAIAppGenerator } from './src/generators/ai-generator-dynamic';

async function testDynamicGenerator() {
  console.log('🚀 Testing Dynamic AI App Generator\n');
  
  const generator = new DynamicAIAppGenerator();
  
  const testPrompts = [
    'Create a todo list app for students',
    'Build a dashboard with analytics and metrics',
    'Make a blog app for writers',
    'Design a simple note-taking application',
    'Create an expense tracker with budget management'
  ];
  
  for (const prompt of testPrompts) {
    console.log(`\n📝 Prompt: "${prompt}"`);
    console.log('─'.repeat(50));
    
    try {
      const appSpec = await generator.generateApp(prompt);
      
      console.log(`✅ App Name: ${appSpec.appName}`);
      console.log(`📊 Database Enabled: ${appSpec.enableDatabase || false}`);
      console.log(`📁 Data Collection: ${appSpec.dataCollection || 'N/A'}`);
      console.log(`🖼  Screens: ${appSpec.screens.length}`);
      
      for (const screen of appSpec.screens) {
        console.log(`  └─ ${screen.name}: ${screen.components.length} components`);
        for (const component of screen.components) {
          console.log(`     └─ ${component.type}`);
        }
      }
    } catch (error) {
      console.error(`❌ Error: ${error}`);
    }
  }
  
  // Test template loader
  console.log('\n\n📚 Testing Template Loader');
  console.log('─'.repeat(50));
  
  const templateLoader = generator.getTemplateLoader();
  const templates = templateLoader.getAllTemplates();
  
  console.log(`Found ${templates.length} templates:`);
  for (const template of templates) {
    console.log(`  • ${template.id}: ${template.name}`);
    console.log(`    Keywords: ${template.keywords.join(', ')}`);
    console.log(`    AI Tags: ${template.aiTags.join(', ')}`);
  }
  
  // Test component mapper
  console.log('\n\n🔧 Testing Component Mapper');
  console.log('─'.repeat(50));
  
  const componentMapper = generator.getComponentMapper();
  const components = componentMapper.getAllComponents();
  
  console.log(`Found ${components.length} components:`);
  const categories = new Set(components.map(c => c.category));
  for (const category of categories) {
    const categoryComponents = componentMapper.getComponentsByCategory(category);
    console.log(`\n  ${category}:`);
    for (const comp of categoryComponents) {
      console.log(`    • ${comp.name} v${comp.version}`);
    }
  }
  
  // Test AI tag matching
  console.log('\n\n🏷  Testing AI Tag Matching');
  console.log('─'.repeat(50));
  
  const testTags = ['form', 'data', 'input'];
  const matches = componentMapper.findComponentsByTags(testTags);
  
  console.log(`Components matching tags [${testTags.join(', ')}]:`);
  for (const match of matches.slice(0, 3)) {
    console.log(`  • ${match.component.name} (score: ${match.score})`);
    console.log(`    Reason: ${match.reason}`);
  }
  
  // Test rule engine
  console.log('\n\n⚙️  Testing Rule Engine');
  console.log('─'.repeat(50));
  
  const ruleEngine = generator.getRuleEngine();
  const rules = ruleEngine.getRules();
  
  console.log(`Found ${rules.length} rules:`);
  for (const rule of rules) {
    console.log(`  • ${rule.name} (priority: ${rule.priority})`);
    console.log(`    ${rule.description}`);
  }
  
  console.log('\n\n✨ Dynamic Generator Test Complete!');
}

// Run the test
testDynamicGenerator().catch(console.error);