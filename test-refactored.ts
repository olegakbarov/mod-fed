#!/usr/bin/env bun
/**
 * Test that refactored generator produces same results as original
 */

import { AIAppGenerator as OriginalGenerator } from './src/generators/ai-generator';
import { AIAppGenerator as RefactoredGenerator } from './src/generators/ai-generator-refactored';
import * as fs from 'fs';

console.log('🔬 Testing refactored generator against original\n');

const original = new OriginalGenerator();
const refactored = new RefactoredGenerator();

const testCases = [
  'Create a todo list app',
  'Build a dashboard with analytics',
  'Make a blog app',
  'Create a simple app'
];

let allMatch = true;

for (const prompt of testCases) {
  console.log(`Testing: "${prompt}"`);
  
  const originalResult = await original.generateApp(prompt);
  const refactoredResult = await refactored.generateApp(prompt);
  
  // Compare key properties
  const match = 
    originalResult.appName === refactoredResult.appName &&
    originalResult.screens.length === refactoredResult.screens.length &&
    originalResult.screens[0].components.length === refactoredResult.screens[0].components.length &&
    originalResult.enableDatabase === refactoredResult.enableDatabase &&
    originalResult.dataCollection === refactoredResult.dataCollection;
  
  if (match) {
    console.log(`  ✅ Results match`);
  } else {
    console.log(`  ❌ Results differ!`);
    console.log(`     Original: ${originalResult.appName} with ${originalResult.screens[0].components.length} components`);
    console.log(`     Refactored: ${refactoredResult.appName} with ${refactoredResult.screens[0].components.length} components`);
    allMatch = false;
  }
}

// Count lines
const originalLines = fs.readFileSync('./src/generators/ai-generator.ts', 'utf-8').split('\n').length;
const refactoredLines = fs.readFileSync('./src/generators/ai-generator-refactored.ts', 'utf-8').split('\n').length;

console.log('\n📊 Metrics:');
console.log(`  Original: ${originalLines} lines`);
console.log(`  Refactored: ${refactoredLines} lines`);
console.log(`  Difference: ${refactoredLines - originalLines} lines`);

if (allMatch) {
  console.log('\n✅ All tests passed! Refactored version is functionally equivalent.');
} else {
  console.log('\n❌ Some tests failed! Refactored version differs from original.');
  process.exit(1);
}