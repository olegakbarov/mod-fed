#!/usr/bin/env bun

import { AIAppGenerator } from "./src/generators/ai-generator";

// Test prompts
const testPrompts = [
  "Create a todo list app with task management",
  "Build a dashboard for analytics and metrics", 
  "Make a blog app where users can write articles",
  "Create a recipe app for storing and sharing cooking recipes",
  "Build a fitness tracker app"
];

async function testAIGeneration() {
  console.log("Testing AI App Generation");
  console.log("=========================\n");

  const generator = new AIAppGenerator();

  for (const prompt of testPrompts) {
    console.log(`Prompt: "${prompt}"`);
    console.log("-".repeat(50));
    
    try {
      const appSpec = await generator.generateApp(prompt);
      console.log("Generated App:");
      console.log(JSON.stringify(appSpec, null, 2));
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : String(error));
    }
    
    console.log("\n");
  }
}

// Run the test
testAIGeneration().catch(console.error);