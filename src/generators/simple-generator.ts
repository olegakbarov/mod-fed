// Simplified AI generator - combines all functionality in one place
import { 
  getTemplate, 
  findBestTemplate, 
  interpolateTemplate, 
  AppTemplate, 
  ComponentDefinition 
} from '../services/templates';
import { applyRules } from '../services/rules';

export interface AppSpec {
  appName: string;
  screens: ScreenSpec[];
  dataCollection?: string;
  enableDatabase?: boolean;
}

export interface ScreenSpec {
  name: string;
  components: ComponentSpec[];
}

export interface ComponentSpec {
  type: string;
  props: Record<string, any>;
}

// Simple generator class
export class SimpleAIGenerator {
  
  async generateApp(userPrompt: string): Promise<AppSpec> {
    try {
      // 1. Extract keywords from prompt
      const keywords = this.extractKeywords(userPrompt);
      
      // 2. Find best matching template
      const template = this.selectTemplate(keywords, userPrompt);
      
      // 3. Customize template with user data
      const customized = this.customizeTemplate(template, userPrompt, keywords);
      
      // 4. Apply rules to optimize components
      const optimized = this.applyOptimizations(customized, userPrompt);
      
      // 5. Convert to final app spec
      return this.convertToAppSpec(optimized);
      
    } catch (error) {
      console.error('Generation error:', error);
      return this.generateFallbackApp(userPrompt);
    }
  }
  
  private extractKeywords(prompt: string): string[] {
    const keywordPatterns = [
      'todo', 'task', 'list', 'dashboard', 'analytics', 'blog', 'article',
      'social', 'chat', 'message', 'calendar', 'schedule', 'tracker',
      'inventory', 'shop', 'store', 'form', 'survey', 'notes'
    ];
    
    const lowerPrompt = prompt.toLowerCase();
    return keywordPatterns.filter(keyword => lowerPrompt.includes(keyword));
  }
  
  private selectTemplate(keywords: string[], prompt: string): AppTemplate {
    // Try to find template by keywords
    if (keywords.length > 0) {
      const template = findBestTemplate(keywords);
      if (template) return template;
    }
    
    // Fallback to intent-based selection
    const lowerPrompt = prompt.toLowerCase();
    
    if (lowerPrompt.includes('todo') || lowerPrompt.includes('task')) {
      return getTemplate('todo-app') || this.getGenericTemplate();
    }
    
    if (lowerPrompt.includes('dashboard') || lowerPrompt.includes('analytics')) {
      return getTemplate('dashboard-app') || this.getGenericTemplate();
    }
    
    if (lowerPrompt.includes('blog') || lowerPrompt.includes('article')) {
      return getTemplate('blog-app') || this.getGenericTemplate();
    }
    
    return this.getGenericTemplate();
  }
  
  private getGenericTemplate(): AppTemplate {
    return getTemplate('generic-app') || {
      id: 'default',
      name: 'Default App',
      description: 'Default application template',
      keywords: ['default'],
      aiTags: ['general'],
      variables: {
        appTitle: 'My App',
        welcomeMessage: 'Welcome to your app'
      },
      screens: [{
        name: 'MainScreen',
        title: 'Main',
        layout: 'vertical',
        components: [
          {
            type: 'Header',
            props: { title: '{{appTitle}}' },
            order: 1
          },
          {
            type: 'Card',
            props: {
              title: 'Welcome',
              content: '{{welcomeMessage}}'
            },
            order: 2
          }
        ]
      }],
      metadata: {
        version: '1.0.0',
        author: 'System',
        category: 'General'
      }
    };
  }
  
  private customizeTemplate(template: AppTemplate, prompt: string, keywords: string[]): AppTemplate {
    // Extract custom variables from prompt
    const variables: Record<string, any> = {
      ...template.variables
    };
    
    // Try to extract app name
    const nameMatch = prompt.match(/(?:called|named|title[d]?)\s+["']?([^"']+)["']?/i);
    if (nameMatch) {
      variables.appTitle = nameMatch[1];
      variables.appName = nameMatch[1];
    } else if (keywords.length > 0) {
      variables.appTitle = keywords[0].charAt(0).toUpperCase() + keywords[0].slice(1) + ' App';
    }
    
    // Set welcome message
    variables.welcomeMessage = `Welcome to ${variables.appTitle || 'your app'}`;
    
    // Interpolate template
    return interpolateTemplate(template, variables);
  }
  
  private applyOptimizations(template: AppTemplate, prompt: string): AppTemplate {
    const optimized = { ...template };
    
    // Determine context from prompt
    const context = {
      hasDatabase: template.enableDatabase || false,
      userIntent: this.determineIntent(prompt),
      platform: 'ios' as const, // Default to iOS
      screenCount: template.screens.length
    };
    
    // Apply rules to each screen
    for (const screen of optimized.screens) {
      const screenContext = {
        ...context,
        screenLayout: screen.layout
      };
      
      screen.components = applyRules(screen.components, screenContext);
      
      // Sort components by order
      screen.components.sort((a, b) => (a.order || 0) - (b.order || 0));
    }
    
    return optimized;
  }
  
  private determineIntent(prompt: string): string {
    const lowerPrompt = prompt.toLowerCase();
    
    if (lowerPrompt.includes('todo') || lowerPrompt.includes('task') || lowerPrompt.includes('list')) {
      return 'productivity';
    }
    if (lowerPrompt.includes('dashboard') || lowerPrompt.includes('analytics')) {
      return 'analytics';
    }
    if (lowerPrompt.includes('blog') || lowerPrompt.includes('article')) {
      return 'content';
    }
    if (lowerPrompt.includes('form') || lowerPrompt.includes('survey')) {
      return 'data_collection';
    }
    
    return 'general';
  }
  
  private convertToAppSpec(template: AppTemplate): AppSpec {
    const spec: AppSpec = {
      appName: template.name,
      screens: template.screens.map(screen => ({
        name: screen.name,
        components: screen.components.map(comp => ({
          type: comp.type,
          props: comp.props
        }))
      }))
    };
    
    if (template.enableDatabase) {
      spec.enableDatabase = true;
      spec.dataCollection = template.dataCollection;
    }
    
    return spec;
  }
  
  private generateFallbackApp(prompt: string): AppSpec {
    const safeTitle = prompt.slice(0, 20);
    
    return {
      appName: 'Generated App',
      screens: [{
        name: 'MainScreen',
        components: [
          {
            type: 'Header',
            props: { title: safeTitle }
          },
          {
            type: 'Card',
            props: {
              title: 'Welcome',
              content: `App generated from: "${safeTitle}..."`
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