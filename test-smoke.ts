#!/usr/bin/env bun
/**
 * Smoke test for AI App Generator
 * This validates that the generator works correctly before and after refactoring
 */

import { AIAppGenerator } from './src/generators/ai-generator';
import * as fs from 'fs';

console.log('🔬 Running smoke tests for AI App Generator\n');

const generator = new AIAppGenerator();
const results: any[] = [];

// Test cases that should work
const testCases = [
  { prompt: 'Create a todo list app', expectedType: 'todo' },
  { prompt: 'Build a dashboard with analytics', expectedType: 'dashboard' },
  { prompt: 'Make a blog app', expectedType: 'blog' },
  { prompt: 'Create a simple app', expectedType: 'default' }
];

let passed = 0;
let failed = 0;

for (const test of testCases) {
  try {
    console.log(`Testing: "${test.prompt}"`);
    const result = await generator.generateApp(test.prompt);
    
    // Basic validation
    console.assert(result.appName, `  ❌ No app name for: ${test.prompt}`);
    console.assert(result.screens?.length > 0, `  ❌ No screens for: ${test.prompt}`);
    console.assert(result.screens[0].components?.length > 0, `  ❌ No components for: ${test.prompt}`);
    
    // Check specific expectations
    if (test.expectedType === 'todo' || test.expectedType === 'blog') {
      console.assert(result.enableDatabase === true, `  ❌ Database should be enabled for ${test.expectedType}`);
      console.assert(result.dataCollection, `  ❌ No data collection for ${test.expectedType}`);
    }
    
    // Store result for baseline
    results.push({
      prompt: test.prompt,
      type: test.expectedType,
      appName: result.appName,
      screenCount: result.screens.length,
      componentCount: result.screens[0].components.length,
      hasDatabase: result.enableDatabase || false,
      dataCollection: result.dataCollection || null
    });
    
    console.log(`  ✅ Passed: ${result.appName} with ${result.screens[0].components.length} components`);
    passed++;
  } catch (error) {
    console.error(`  ❌ Failed: ${error}`);
    failed++;
  }
}

// Save baseline for comparison
const baseline = {
  timestamp: new Date().toISOString(),
  version: '1.0.0',
  results: results,
  summary: {
    total: testCases.length,
    passed: passed,
    failed: failed
  }
};

fs.writeFileSync('baseline.json', JSON.stringify(baseline, null, 2));

console.log('\n📊 Summary:');
console.log(`  Total tests: ${testCases.length}`);
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);
console.log(`  Baseline saved to: baseline.json`);

if (failed > 0) {
  console.error('\n❌ Some tests failed!');
  process.exit(1);
} else {
  console.log('\n✅ All smoke tests passed!');
}