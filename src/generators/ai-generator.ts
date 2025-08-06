import { generateObject } from 'ai';
import { openai, createOpenAI } from '@ai-sdk/openai';
import { anthropic, createAnthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { AI_CONFIG, SYSTEM_PROMPT } from '../config/ai-config';
import { metricsCollector } from '../monitoring/metrics';
import { logger, generateCorrelationId } from '../monitoring/logger';
import { generationCache } from '../cache/generation-cache';
import {
  AIProviderError,
  AIRateLimitError,
  AIAuthenticationError,
  AIQuotaExceededError,
  AIModelUnavailableError,
  AIGenerationTimeoutError,
  AIInvalidResponseError,
  ValidationError,
  isRetryableError,
  getRetryDelay,
  sanitizeErrorForLogging
} from '../errors/ai-errors';

const ComponentSpecSchema = z.object({
  type: z.string(),
  props: z.record(z.string(), z.any()),
});

const ScreenSpecSchema = z.object({
  name: z.string(),
  components: z.array(ComponentSpecSchema),
});

const AppSpecSchema = z.object({
  appName: z.string(),
  screens: z.array(ScreenSpecSchema),
  dataCollection: z.string().optional(),
  enableDatabase: z.boolean().optional(),
});

export type ComponentSpec = z.infer<typeof ComponentSpecSchema>;
export type ScreenSpec = z.infer<typeof ScreenSpecSchema>;
export type AppSpec = z.infer<typeof AppSpecSchema>;

export class AIAppGenerator {
  private provider: any;
  private maxRetries: number = 3;
  private timeoutMs: number = 30000; // 30 seconds

  constructor() {
    if (AI_CONFIG.provider === 'anthropic') {
      const anthropicProvider = AI_CONFIG.apiKey 
        ? createAnthropic({ apiKey: AI_CONFIG.apiKey })
        : anthropic;
      this.provider = anthropicProvider(AI_CONFIG.model || 'claude-3-5-sonnet-20241022');
    } else {
      const openaiProvider = AI_CONFIG.apiKey 
        ? createOpenAI({ apiKey: AI_CONFIG.apiKey })
        : openai;
      this.provider = openaiProvider(AI_CONFIG.model || 'gpt-4o-mini');
    }

    logger.info('AI App Generator initialized', {
      generator: {
        provider: AI_CONFIG.provider,
        model: AI_CONFIG.model,
        hasApiKey: Boolean(AI_CONFIG.apiKey),
        maxRetries: this.maxRetries,
        timeoutMs: this.timeoutMs,
      },
    });
  }

  async generateApp(userPrompt: string, correlationId?: string): Promise<AppSpec> {
    const cId = correlationId || generateCorrelationId();
    const startTime = Date.now();
    
    // Validate input
    if (!userPrompt || typeof userPrompt !== 'string') {
      throw new ValidationError('Prompt must be a non-empty string', 'prompt', userPrompt, cId);
    }

    if (userPrompt.trim().length === 0) {
      throw new ValidationError('Prompt cannot be empty', 'prompt', userPrompt, cId);
    }

    logger.info('Starting app generation', {
      generation: {
        prompt: userPrompt.slice(0, 100), // Truncate for logging
        provider: AI_CONFIG.provider,
        model: AI_CONFIG.model,
        hasApiKey: Boolean(AI_CONFIG.apiKey),
      },
    }, cId);

    try {
      // Check cache first
      const cachedResult = this.getCachedResult(userPrompt, cId);
      if (cachedResult) {
        const responseTime = Date.now() - startTime;
        this.recordSuccessMetrics(userPrompt, responseTime, true, false, cId);
        return cachedResult;
      }

      // If no API key is configured, fall back to hardcoded logic
      if (!AI_CONFIG.apiKey) {
        logger.warn('No AI API key configured, using fallback logic', {
          generation: { fallback: true, reason: 'no_api_key' },
        }, cId);
        
        const result = await this.generateFallbackApp(userPrompt, cId);
        const responseTime = Date.now() - startTime;
        
        // Cache fallback results too
        this.cacheResult(userPrompt, result, responseTime, cId);
        this.recordSuccessMetrics(userPrompt, responseTime, true, true, cId);
        
        return result;
      }

      // Attempt AI generation with retries
      const result = await this.generateWithRetries(userPrompt, cId, startTime);
      
      // Cache successful result
      this.cacheResult(userPrompt, result, Date.now() - startTime, cId);
      
      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      logger.error('App generation failed, attempting fallback', error as Error, {
        generation: {
          prompt: userPrompt.slice(0, 100),
          responseTime,
          attemptedFallback: true,
        },
      }, cId);

      this.recordErrorMetrics(userPrompt, responseTime, error as Error, cId);

      // Try fallback as last resort
      try {
        const fallbackResult = await this.generateFallbackApp(userPrompt, cId);
        const fallbackResponseTime = Date.now() - startTime;
        
        this.recordSuccessMetrics(userPrompt, fallbackResponseTime, true, true, cId);
        return fallbackResult;
      } catch (fallbackError) {
        logger.fatal('Both AI generation and fallback failed', fallbackError as Error, {
          generation: { totalResponseTime: Date.now() - startTime },
        }, cId);
        
        throw error; // Throw original error, not fallback error
      }
    }
  }

  // Helper methods for caching
  private getCachedResult(prompt: string, correlationId: string): AppSpec | null {
    try {
      const cached = generationCache.get(prompt, AI_CONFIG.provider, AI_CONFIG.model || '', correlationId);
      if (cached) {
        logger.debug('Cache hit for prompt', {
          cache: { hit: true, prompt: prompt.slice(0, 50) },
        }, correlationId);
      }
      return cached;
    } catch (error) {
      logger.warn('Cache lookup failed', error as Error, {
        cache: { operation: 'get', prompt: prompt.slice(0, 50) },
      }, correlationId);
      return null;
    }
  }

  private cacheResult(prompt: string, result: AppSpec, generationTime: number, correlationId: string): void {
    try {
      generationCache.set(
        prompt,
        result,
        AI_CONFIG.provider,
        AI_CONFIG.model || '',
        generationTime,
        undefined, // Use default TTL
        correlationId
      );
      logger.debug('Result cached', {
        cache: { operation: 'set', generationTime },
      }, correlationId);
    } catch (error) {
      logger.warn('Failed to cache result', error as Error, {
        cache: { operation: 'set' },
      }, correlationId);
    }
  }

  // Helper methods for metrics
  private recordSuccessMetrics(prompt: string, responseTime: number, success: boolean, fallbackUsed: boolean, correlationId: string): void {
    metricsCollector.recordGeneration({
      prompt,
      success,
      responseTime,
      timestamp: Date.now(),
      provider: AI_CONFIG.provider,
      model: AI_CONFIG.model || '',
      fallbackUsed,
      correlationId,
    });

    logger.generation(prompt, success, AI_CONFIG.provider, AI_CONFIG.model || '', responseTime, fallbackUsed, undefined, correlationId);
  }

  private recordErrorMetrics(prompt: string, responseTime: number, error: Error, correlationId: string): void {
    metricsCollector.recordGeneration({
      prompt,
      success: false,
      responseTime,
      timestamp: Date.now(),
      provider: AI_CONFIG.provider,
      model: AI_CONFIG.model || '',
      fallbackUsed: false,
      correlationId,
      error: error.message,
    });

    logger.generation(prompt, false, AI_CONFIG.provider, AI_CONFIG.model || '', responseTime, false, undefined, correlationId, error);
  }

  // AI generation with retries
  private async generateWithRetries(prompt: string, correlationId: string, startTime: number): Promise<AppSpec> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        logger.debug(`AI generation attempt ${attempt}/${this.maxRetries}`, {
          generation: { attempt, prompt: prompt.slice(0, 50) },
        }, correlationId);

        const result = await this.performAIGeneration(prompt, correlationId);
        const responseTime = Date.now() - startTime;
        
        this.recordSuccessMetrics(prompt, responseTime, true, false, correlationId);
        return result;
      } catch (error) {
        lastError = this.classifyAndTransformError(error as Error, correlationId);
        
        logger.warn(`AI generation attempt ${attempt} failed`, lastError, {
          generation: {
            attempt,
            retriesRemaining: this.maxRetries - attempt,
            retryable: isRetryableError(lastError),
          },
        }, correlationId);

        // Don't retry if error is not retryable
        if (!isRetryableError(lastError)) {
          break;
        }

        // Don't retry on last attempt
        if (attempt === this.maxRetries) {
          break;
        }

        // Wait before retry
        const delay = getRetryDelay(lastError, attempt);
        if (delay > 0) {
          logger.debug(`Waiting ${delay}ms before retry`, {
            generation: { delay, attempt },
          }, correlationId);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new AIProviderError('AI generation failed after retries', AI_CONFIG.provider, AI_CONFIG.model || '', false, correlationId);
  }

  // Perform actual AI generation
  private async performAIGeneration(prompt: string, correlationId: string): Promise<AppSpec> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new AIGenerationTimeoutError(`AI generation timed out after ${this.timeoutMs}ms`, this.timeoutMs, correlationId));
      }, this.timeoutMs);
    });

    try {
      const generationPromise = generateObject({
        model: this.provider,
        schema: AppSpecSchema,
        system: SYSTEM_PROMPT,
        prompt,
        temperature: AI_CONFIG.temperature,
      });

      const { object, usage } = await Promise.race([generationPromise, timeoutPromise]);

      if (!object) {
        throw new AIInvalidResponseError('AI provider returned null response', AI_CONFIG.provider, 'null', correlationId);
      }

      // Log token usage if available
      if (usage) {
        logger.debug('AI generation completed', {
          generation: {
            tokenUsage: usage,
            provider: AI_CONFIG.provider,
            model: AI_CONFIG.model,
          },
        }, correlationId);

        // Record token usage in metrics if available
        metricsCollector.recordGeneration({
          prompt,
          success: true,
          responseTime: Date.now(),
          timestamp: Date.now(),
          provider: AI_CONFIG.provider,
          model: AI_CONFIG.model || '',
          fallbackUsed: false,
          tokenUsage: {
            promptTokens: usage.promptTokens,
            completionTokens: usage.completionTokens,
          },
          correlationId,
        });
      }

      return object;
    } catch (error) {
      if (error instanceof AIGenerationTimeoutError) {
        throw error;
      }
      throw this.classifyAndTransformError(error as Error, correlationId);
    }
  }

  // Error classification and transformation
  private classifyAndTransformError(error: Error, correlationId: string): Error {
    const errorMessage = error.message.toLowerCase();

    // Rate limiting
    if (errorMessage.includes('rate limit') || errorMessage.includes('too many requests')) {
      return new AIRateLimitError(error.message, AI_CONFIG.provider, 'requests', undefined, correlationId);
    }

    // Authentication errors
    if (errorMessage.includes('unauthorized') || errorMessage.includes('invalid api key') || errorMessage.includes('authentication')) {
      return new AIAuthenticationError(error.message, AI_CONFIG.provider, correlationId);
    }

    // Quota exceeded
    if (errorMessage.includes('quota') || errorMessage.includes('billing') || errorMessage.includes('insufficient credits')) {
      return new AIQuotaExceededError(error.message, AI_CONFIG.provider, 'credits', undefined, correlationId);
    }

    // Model unavailable
    if (errorMessage.includes('model') && (errorMessage.includes('unavailable') || errorMessage.includes('not found'))) {
      return new AIModelUnavailableError(error.message, AI_CONFIG.provider, AI_CONFIG.model || '', correlationId);
    }

    // Network/connection errors
    if (errorMessage.includes('network') || errorMessage.includes('connection') || errorMessage.includes('timeout')) {
      return new AIProviderError(error.message, AI_CONFIG.provider, AI_CONFIG.model || '', true, correlationId, error);
    }

    // Default to provider error
    return new AIProviderError(error.message, AI_CONFIG.provider, AI_CONFIG.model || '', true, correlationId, error);
  }

  // Fallback logic when AI API is not available
  private async generateFallbackApp(userPrompt: string, correlationId?: string): Promise<AppSpec> {
    const cId = correlationId || generateCorrelationId();
    const prompt = userPrompt.toLowerCase();
    
    logger.info('Using fallback app generation', {
      generation: { fallback: true, prompt: prompt.slice(0, 50) },
    }, cId);
    
    let result: AppSpec;
    
    if (prompt.includes('todo') || prompt.includes('task')) {
      result = this.generateTodoApp();
    } else if (prompt.includes('dashboard') || prompt.includes('analytics')) {
      result = this.generateDashboardApp();
    } else if (prompt.includes('blog') || prompt.includes('article')) {
      result = this.generateBlogApp();
    } else {
      result = this.generateDefaultApp(userPrompt);
    }

    logger.info('Fallback app generated', {
      generation: {
        appName: result.appName,
        fallback: true,
        screensCount: result.screens.length,
        hasDatabase: result.enableDatabase,
      },
    }, cId);

    return result;
  }

  private generateTodoApp(): AppSpec {
    return {
      appName: 'Todo List App',
      dataCollection: 'todos',
      enableDatabase: true,
      screens: [{
        name: 'MainScreen',
        components: [
          {
            type: 'Header',
            props: { title: 'My Tasks' }
          },
          {
            type: 'DataForm',
            props: { 
              collection: 'todos',
              fields: [
                { name: 'title', label: 'Task', placeholder: 'Enter task...' },
                { name: 'description', label: 'Description', type: 'multiline', placeholder: 'Task details...' }
              ],
              submitLabel: 'Add Task'
            }
          },
          {
            type: 'DataList',
            props: {
              collection: 'todos',
              onDelete: true
            }
          }
        ]
      }]
    };
  }

  private generateDashboardApp(): AppSpec {
    return {
      appName: 'Dashboard App',
      screens: [{
        name: 'DashboardScreen',
        components: [
          {
            type: 'Header',
            props: { title: 'Analytics Dashboard' }
          },
          {
            type: 'Card',
            props: {
              title: 'Total Users',
              content: '1,234 active users this month'
            }
          },
          {
            type: 'Card',
            props: {
              title: 'Revenue',
              content: '$45,678 this quarter'
            }
          },
          {
            type: 'List',
            props: {
              items: [
                { title: 'Recent Activity 1' },
                { title: 'Recent Activity 2' },
                { title: 'Recent Activity 3' }
              ]
            }
          }
        ]
      }]
    };
  }

  private generateBlogApp(): AppSpec {
    return {
      appName: 'Blog App',
      dataCollection: 'posts',
      enableDatabase: true,
      screens: [{
        name: 'BlogScreen',
        components: [
          {
            type: 'Header',
            props: { title: 'My Blog' }
          },
          {
            type: 'DataForm',
            props: {
              collection: 'posts',
              fields: [
                { name: 'title', label: 'Title', placeholder: 'Post title...' },
                { name: 'content', label: 'Content', type: 'multiline', placeholder: 'Write your post...' }
              ],
              submitLabel: 'Publish Post'
            }
          },
          {
            type: 'DataList',
            props: {
              collection: 'posts',
              onDelete: true
            }
          }
        ]
      }]
    };
  }

  private generateDefaultApp(prompt: string): AppSpec {
    return {
      appName: 'Generated App',
      screens: [{
        name: 'MainScreen',
        components: [
          {
            type: 'Header',
            props: { title: prompt.slice(0, 20) }
          },
          {
            type: 'Card',
            props: {
              title: 'Welcome',
              content: `App generated from: "${prompt}"`
            }
          },
          {
            type: 'Button',
            props: { label: 'Get Started' }
          }
        ]
      }]
    };
  }
}