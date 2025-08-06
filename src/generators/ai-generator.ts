import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { AI_CONFIG, SYSTEM_PROMPT } from '../config/ai-config';

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

  constructor() {
    if (AI_CONFIG.provider === 'anthropic') {
      this.provider = anthropic(AI_CONFIG.model || 'claude-3-5-sonnet-20241022');
    } else {
      this.provider = openai(AI_CONFIG.model || 'gpt-4o-mini');
    }
  }

  async generateApp(userPrompt: string): Promise<AppSpec> {
    try {
      // If no API key is configured, fall back to hardcoded logic
      if (!AI_CONFIG.apiKey) {
        console.warn('No AI API key configured, using fallback logic');
        return this.generateFallbackApp(userPrompt);
      }

      // Use Vercel AI SDK to generate app specification
      const { object } = await generateObject({
        model: this.provider,
        schema: AppSpecSchema,
        system: SYSTEM_PROMPT,
        prompt: userPrompt,
        temperature: AI_CONFIG.temperature,
      });

      return object;
    } catch (error) {
      console.error('AI generation failed, using fallback:', error);
      return this.generateFallbackApp(userPrompt);
    }
  }

  // Fallback logic when AI API is not available
  private generateFallbackApp(userPrompt: string): AppSpec {
    const prompt = userPrompt.toLowerCase();
    
    if (prompt.includes('todo') || prompt.includes('task')) {
      return this.generateTodoApp();
    } else if (prompt.includes('dashboard') || prompt.includes('analytics')) {
      return this.generateDashboardApp();
    } else if (prompt.includes('blog') || prompt.includes('article')) {
      return this.generateBlogApp();
    } else {
      return this.generateDefaultApp(userPrompt);
    }
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