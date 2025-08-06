import CircuitBreaker from 'opossum';
import { generateObject } from 'ai';
import { openai, createOpenAI } from '@ai-sdk/openai';
import { anthropic, createAnthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { AI_CONFIG, SYSTEM_PROMPT } from '../config/ai-config';

// Define the app specification schema
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

export type AppSpec = z.infer<typeof AppSpecSchema>;

/**
 * Simple AI service with opossum circuit breaker.
 * Keeps configuration minimal and uses proven defaults.
 */
export class SimpleAIService {
  private provider: any;
  private aiCircuitBreaker: CircuitBreaker<[string], AppSpec>;

  constructor() {
    // Initialize AI provider
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

    // Circuit breaker options - keep it simple with proven defaults
    const options = {
      timeout: 10000, // 10 seconds
      errorThresholdPercentage: 50, // Open circuit at 50% error rate
      resetTimeout: 30000, // Try again after 30 seconds
      name: 'AI-Service',
    };

    // Create circuit breaker around the AI generation function
    this.aiCircuitBreaker = new CircuitBreaker(this.performAIGeneration.bind(this), options);

    // Add simple monitoring events
    this.aiCircuitBreaker.on('open', () => {
      console.log('🚨 AI Circuit breaker opened - too many failures');
    });

    this.aiCircuitBreaker.on('halfOpen', () => {
      console.log('🔄 AI Circuit breaker half-open - testing recovery');
    });

    this.aiCircuitBreaker.on('close', () => {
      console.log('✅ AI Circuit breaker closed - service recovered');
    });

    this.aiCircuitBreaker.on('failure', (error) => {
      console.log('❌ AI generation failed:', error.message);
    });

    this.aiCircuitBreaker.on('success', () => {
      console.log('✨ AI generation successful');
    });

    console.log('🤖 Simple AI service initialized with circuit breaker');
  }

  /**
   * Generate an app specification from a user prompt.
   * Falls back to hardcoded templates when circuit is open.
   */
  async generateApp(prompt: string): Promise<AppSpec> {
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      throw new Error('Prompt must be a non-empty string');
    }

    try {
      // Try AI generation through circuit breaker
      return await this.aiCircuitBreaker.fire(prompt);
    } catch (error) {
      console.log('⚠️ Circuit open or AI failed, using fallback template');
      return this.getFallbackApp(prompt);
    }
  }

  /**
   * Perform the actual AI generation (wrapped by circuit breaker)
   */
  private async performAIGeneration(prompt: string): Promise<AppSpec> {
    if (!AI_CONFIG.apiKey) {
      throw new Error('No AI API key configured');
    }

    const { object } = await generateObject({
      model: this.provider,
      schema: AppSpecSchema,
      system: SYSTEM_PROMPT,
      prompt,
      temperature: AI_CONFIG.temperature,
    });

    if (!object) {
      throw new Error('AI provider returned null response');
    }

    return object;
  }

  /**
   * Simple fallback logic when AI is unavailable.
   * Returns basic app templates based on keywords.
   */
  private getFallbackApp(prompt: string): AppSpec {
    const lowerPrompt = prompt.toLowerCase();

    if (lowerPrompt.includes('todo') || lowerPrompt.includes('task')) {
      return this.getTodoAppTemplate();
    }

    if (lowerPrompt.includes('dashboard') || lowerPrompt.includes('analytics')) {
      return this.getDashboardAppTemplate();
    }

    if (lowerPrompt.includes('blog') || lowerPrompt.includes('article')) {
      return this.getBlogAppTemplate();
    }

    return this.getGenericAppTemplate(prompt);
  }

  private getTodoAppTemplate(): AppSpec {
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

  private getDashboardAppTemplate(): AppSpec {
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

  private getBlogAppTemplate(): AppSpec {
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

  private getGenericAppTemplate(prompt: string): AppSpec {
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

  /**
   * Get circuit breaker statistics for monitoring
   */
  getStats() {
    const stats = this.aiCircuitBreaker.stats;
    return {
      isOpen: this.aiCircuitBreaker.opened,
      isHalfOpen: this.aiCircuitBreaker.halfOpen,
      failures: stats.failures,
      successes: stats.successes,
      rejects: stats.rejects,
      fires: stats.fires,
      lastFireTime: stats.latencyTimes[stats.latencyTimes.length - 1] || 0,
    };
  }

  /**
   * Force circuit breaker to open (for testing/maintenance)
   */
  forceOpen() {
    this.aiCircuitBreaker.open();
  }

  /**
   * Force circuit breaker to close (for testing/maintenance)
   */
  forceClose() {
    this.aiCircuitBreaker.close();
  }
}

// Export singleton instance
let _aiService: SimpleAIService | null = null;

export function getAIService(): SimpleAIService {
  if (!_aiService) {
    _aiService = new SimpleAIService();
  }
  return _aiService;
}

// Convenience function for direct use
export async function generateApp(prompt: string): Promise<AppSpec> {
  const service = getAIService();
  return service.generateApp(prompt);
}