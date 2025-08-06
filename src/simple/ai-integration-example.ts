/**
 * Example integration of the Simple AI Service with Circuit Breaker
 * 
 * This demonstrates how to use the simple AI service in different scenarios:
 * - Normal operation with AI API
 * - Fallback when circuit is open
 * - Monitoring and statistics
 */

import { generateApp, getAIService, AppSpec } from './ai-service';

/**
 * Basic usage example - just generate an app
 */
export async function basicExample() {
  console.log('🚀 Basic AI generation example');
  
  try {
    const appSpec = await generateApp('Create a todo list app for managing daily tasks');
    console.log('✅ Generated app:', appSpec.appName);
    console.log('📱 Screens:', appSpec.screens.length);
    console.log('🗄️ Database enabled:', appSpec.enableDatabase);
    return appSpec;
  } catch (error) {
    console.error('❌ Failed to generate app:', error.message);
    throw error;
  }
}

/**
 * Express.js integration example
 */
export function createExpressHandler() {
  return async (req: any, res: any) => {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    try {
      const startTime = Date.now();
      const appSpec = await generateApp(prompt);
      const responseTime = Date.now() - startTime;
      
      // Get circuit breaker stats for monitoring
      const aiService = getAIService();
      const stats = aiService.getStats();
      
      res.json({
        success: true,
        appSpec,
        metadata: {
          responseTime,
          circuitBreakerStats: stats,
          fallbackUsed: stats.isOpen,
        },
      });
    } catch (error) {
      console.error('Express handler error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };
}

/**
 * Batch processing example with error handling
 */
export async function batchGenerateApps(prompts: string[]): Promise<Array<{ prompt: string; result?: AppSpec; error?: string }>> {
  console.log(`📦 Batch processing ${prompts.length} prompts`);
  
  const results = [];
  
  for (const [index, prompt] of prompts.entries()) {
    console.log(`🔄 Processing ${index + 1}/${prompts.length}: ${prompt.slice(0, 50)}...`);
    
    try {
      const result = await generateApp(prompt);
      results.push({ prompt, result });
      console.log(`✅ Success: ${result.appName}`);
    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);
      results.push({ prompt, error: error.message });
    }
    
    // Brief pause between requests to avoid overwhelming the AI API
    if (index < prompts.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return results;
}

/**
 * Monitoring example - check circuit breaker health
 */
export function monitorAIService() {
  const aiService = getAIService();
  
  const checkHealth = () => {
    const stats = aiService.getStats();
    const timestamp = new Date().toISOString();
    
    console.log(`[${timestamp}] AI Service Health Check:`);
    console.log(`  Circuit State: ${stats.isOpen ? '🔴 OPEN' : stats.isHalfOpen ? '🟡 HALF-OPEN' : '🟢 CLOSED'}`);
    console.log(`  Total Fires: ${stats.fires}`);
    console.log(`  Successes: ${stats.successes}`);
    console.log(`  Failures: ${stats.failures}`);
    console.log(`  Rejects: ${stats.rejects}`);
    console.log(`  Last Fire Time: ${stats.lastFireTime}ms`);
    console.log('---');
    
    return stats;
  };
  
  // Check immediately
  checkHealth();
  
  // Set up periodic monitoring (every 30 seconds)
  const interval = setInterval(checkHealth, 30000);
  
  // Return cleanup function
  return () => {
    clearInterval(interval);
    console.log('🛑 Monitoring stopped');
  };
}

/**
 * Circuit breaker testing example
 */
export async function testCircuitBreaker() {
  console.log('🧪 Testing circuit breaker behavior');
  const aiService = getAIService();
  
  // Force circuit open for testing
  console.log('🔴 Forcing circuit breaker open');
  aiService.forceOpen();
  
  try {
    const result = await generateApp('Test prompt during open circuit');
    console.log('✅ Fallback worked:', result.appName);
  } catch (error) {
    console.log('❌ Unexpected error:', error.message);
  }
  
  // Wait a bit then force close
  setTimeout(() => {
    console.log('🟢 Forcing circuit breaker closed');
    aiService.forceClose();
  }, 2000);
}

/**
 * Production-ready service wrapper with error handling
 */
export class ProductionAIService {
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000; // 1 second
  
  async generateAppWithRetries(prompt: string): Promise<AppSpec> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`🔄 Attempt ${attempt}/${this.maxRetries}: ${prompt.slice(0, 30)}...`);
        const result = await generateApp(prompt);
        console.log(`✅ Success on attempt ${attempt}: ${result.appName}`);
        return result;
      } catch (error) {
        lastError = error;
        console.log(`❌ Attempt ${attempt} failed: ${error.message}`);
        
        if (attempt < this.maxRetries) {
          console.log(`⏳ Retrying in ${this.retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        }
      }
    }
    
    console.log(`💥 All ${this.maxRetries} attempts failed`);
    throw lastError;
  }
  
  async generateWithTimeout(prompt: string, timeoutMs: number = 15000): Promise<AppSpec> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Generation timeout after ${timeoutMs}ms`)), timeoutMs);
    });
    
    const generationPromise = this.generateAppWithRetries(prompt);
    
    return Promise.race([generationPromise, timeoutPromise]);
  }
}

// Example usage patterns
if (require.main === module) {
  console.log('🎯 Running AI service integration examples');
  
  (async () => {
    try {
      // Basic example
      await basicExample();
      
      // Batch example
      const prompts = [
        'Create a todo app',
        'Build a dashboard',
        'Make a blog app'
      ];
      await batchGenerateApps(prompts);
      
      // Start monitoring
      const stopMonitoring = monitorAIService();
      
      // Test circuit breaker
      await testCircuitBreaker();
      
      // Clean up after 10 seconds
      setTimeout(stopMonitoring, 10000);
      
    } catch (error) {
      console.error('Example failed:', error);
    }
  })();
}