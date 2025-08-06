/**
 * AI App Generator - Final Version
 * Simple, maintainable, and extensible
 */

import { templates, Template, AppSpec } from './templates';

export interface GeneratorConfig {
  customTemplates?: Template[];
  defaultAppName?: string;
}

export class AIAppGenerator {
  private allTemplates: Template[];
  private config: GeneratorConfig;

  constructor(config: GeneratorConfig = {}) {
    this.config = config;
    // Merge custom templates with built-in ones
    this.allTemplates = [
      ...templates,
      ...(config.customTemplates || [])
    ];
  }

  async generateApp(userPrompt: string): Promise<AppSpec> {
    const template = this.findTemplate(userPrompt);
    
    if (template) {
      return template.generate();
    }
    
    // Default fallback for unmatched prompts
    return this.generateDefaultApp(userPrompt);
  }

  private findTemplate(prompt: string): Template | undefined {
    const lowerPrompt = prompt.toLowerCase();
    
    // Find the first template that matches any keyword
    return this.allTemplates.find(template => 
      template.keywords.some(keyword => lowerPrompt.includes(keyword))
    );
  }

  private generateDefaultApp(prompt: string): AppSpec {
    return {
      appName: this.config.defaultAppName || 'Generated App',
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

  // Utility method to add templates at runtime
  addTemplate(template: Template): void {
    this.allTemplates.push(template);
  }

  // Get all available templates (useful for UI/debugging)
  getTemplates(): Template[] {
    return [...this.allTemplates];
  }
}