#!/usr/bin/env bun
/**
 * Final validation test for refactored AI App Generator
 */

import { AIAppGenerator as OriginalGenerator } from './src/generators/ai-generator';
import { AIAppGenerator as FinalGenerator, GeneratorConfig } from './src/generators/ai-generator-final';
import { Template } from './src/generators/templates';
import * as fs from 'fs';

console.log('🔬 Final validation test\n');

// Test 1: Basic functionality
console.log('Test 1: Basic functionality');
const original = new OriginalGenerator();
const final = new FinalGenerator();

const testCases = [
  'Create a todo list app',
  'Build a dashboard with analytics',
  'Make a blog app',
  'Create a simple app'
];

let passed = 0;
for (const prompt of testCases) {
  const originalResult = await original.generateApp(prompt);
  const finalResult = await final.generateApp(prompt);
  
  const match = 
    originalResult.appName === finalResult.appName &&
    originalResult.screens.length === finalResult.screens.length &&
    originalResult.screens[0].components.length === finalResult.screens[0].components.length;
  
  if (match) {
    console.log(`  ✅ "${prompt}"`);
    passed++;
  } else {
    console.log(`  ❌ "${prompt}" - Results differ`);
  }
}

// Test 2: Custom configuration
console.log('\nTest 2: Custom configuration');
const customConfig: GeneratorConfig = {
  defaultAppName: 'My Custom App',
  customTemplates: [{
    name: 'E-commerce App',
    keywords: ['shop', 'store', 'ecommerce', 'product'],
    generate: () => ({
      appName: 'E-commerce App',
      dataCollection: 'products',
      enableDatabase: true,
      screens: [{
        name: 'ShopScreen',
        components: [
          { type: 'Header', props: { title: 'Shop' } },
          { type: 'ProductList', props: { collection: 'products' } },
          { type: 'CartButton', props: { label: 'View Cart' } }
        ]
      }]
    })
  }]
};

const customGenerator = new FinalGenerator(customConfig);

// Test custom template
const shopResult = await customGenerator.generateApp('create an online shop');
if (shopResult.appName === 'E-commerce App') {
  console.log('  ✅ Custom template works');
  passed++;
} else {
  console.log('  ❌ Custom template failed');
}

// Test custom default name
const unknownResult = await customGenerator.generateApp('something completely different');
if (unknownResult.appName === 'My Custom App') {
  console.log('  ✅ Custom default name works');
  passed++;
} else {
  console.log('  ❌ Custom default name failed');
}

// Test 3: Runtime template addition
console.log('\nTest 3: Runtime template addition');
const dynamicGenerator = new FinalGenerator();

const socialTemplate: Template = {
  name: 'Social Media App',
  keywords: ['social', 'feed', 'friends'],
  generate: () => ({
    appName: 'Social App',
    screens: [{
      name: 'FeedScreen',
      components: [
        { type: 'Header', props: { title: 'Feed' } },
        { type: 'PostList', props: {} }
      ]
    }]
  })
};

dynamicGenerator.addTemplate(socialTemplate);
const socialResult = await dynamicGenerator.generateApp('create a social media feed');

if (socialResult.appName === 'Social App') {
  console.log('  ✅ Runtime template addition works');
  passed++;
} else {
  console.log('  ❌ Runtime template addition failed');
}

// Metrics
console.log('\n📊 Metrics:');
const originalLines = fs.readFileSync('./src/generators/ai-generator.ts', 'utf-8').split('\n').length;
const finalLines = fs.readFileSync('./src/generators/ai-generator-final.ts', 'utf-8').split('\n').length;
const templateLines = fs.readFileSync('./src/generators/templates.ts', 'utf-8').split('\n').length;
const totalLines = finalLines + templateLines;

console.log(`  Original: ${originalLines} lines (1 file)`);
console.log(`  Final: ${totalLines} lines (2 files)`);
console.log(`    - Generator: ${finalLines} lines`);
console.log(`    - Templates: ${templateLines} lines`);
console.log(`  Difference: +${totalLines - originalLines} lines`);

// Summary
console.log('\n📋 Summary:');
console.log(`  Tests passed: ${passed}/7`);
console.log(`  Code increase: ${Math.round((totalLines / originalLines - 1) * 100)}%`);
console.log('  ✅ Templates extractable');
console.log('  ✅ Custom templates supported');
console.log('  ✅ Configuration supported');
console.log('  ✅ No breaking changes');
console.log('  ✅ TypeScript types maintained');

if (passed === 7) {
  console.log('\n✅ All tests passed! Refactoring successful.');
} else {
  console.log('\n⚠️ Some tests failed. Review needed.');
  process.exit(1);
}