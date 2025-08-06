import { TemplateLoader, AppTemplate, ComponentDefinition } from '../services/template-loader';
import { ComponentMapper } from '../services/component-mapper';
import { RuleEngine } from '../services/rule-engine';
import * as path from 'path';

interface ComponentSpec {
  type: string;
  props: Record<string, any>;
}

interface ScreenSpec {
  name: string;
  components: ComponentSpec[];
}

interface AppSpec {
  appName: string;
  screens: ScreenSpec[];
  dataCollection?: string;
  enableDatabase?: boolean;
}

export class DynamicAIAppGenerator {
  private templateLoader: TemplateLoader;
  private componentMapper: ComponentMapper;
  private ruleEngine: RuleEngine;
  
  constructor() {
    // Initialize with correct path based on runtime environment
    const templatePath = typeof __dirname !== 'undefined' 
      ? path.join(__dirname, '../templates')
      : './src/templates';
    
    this.templateLoader = new TemplateLoader(templatePath);
    this.componentMapper = new ComponentMapper();
    this.ruleEngine = new RuleEngine();
    
    // Enable hot reload in development
    if (process.env.NODE_ENV !== 'production') {
      this.templateLoader.enableHotReload((template) => {
        console.log(`Template ${template.id} reloaded`);
      });
    }
  }
  
  async generateApp(userPrompt: string): Promise<AppSpec> {
    try {
      // Step 1: Analyze user prompt
      const analysis = this.analyzePrompt(userPrompt);
      
      // Step 2: Find best matching template
      const template = this.selectTemplate(analysis);
      
      if (!template) {
        // Fallback to generic template
        return this.generateFromGenericTemplate(userPrompt, analysis);
      }
      
      // Step 3: Customize template based on analysis
      const customVariables = this.extractCustomVariables(userPrompt, analysis);
      const customizedTemplate = this.templateLoader.interpolateTemplate(template, customVariables);
      
      // Step 4: Process components and apply rules
      const processedTemplate = this.processComponents(customizedTemplate, analysis);
      
      // Step 5: Convert to AppSpec format
      return this.convertToAppSpec(processedTemplate);
    } catch (error) {
      console.error('Error generating app:', error);
      // Fallback to a simple default app
      return this.generateDefaultApp(userPrompt);
    }
  }
  
  private analyzePrompt(prompt: string): {
    keywords: string[];
    intent: string;
    entities: Record<string, string>;
    tags: string[];
  } {
    const lowerPrompt = prompt.toLowerCase();
    
    // Extract keywords
    const keywords = this.extractKeywords(lowerPrompt);
    
    // Determine intent
    const intent = this.determineIntent(lowerPrompt, keywords);
    
    // Extract entities (app name, features, etc.)
    const entities = this.extractEntities(prompt);
    
    // Generate AI tags based on analysis
    const tags = this.generateTags(keywords, intent);
    
    return { keywords, intent, entities, tags };
  }
  
  private extractKeywords(text: string): string[] {
    // Common app-related keywords
    const keywordPatterns = [
      'todo', 'task', 'list', 'dashboard', 'analytics', 'blog', 'article',
      'social', 'chat', 'message', 'calendar', 'schedule', 'tracker',
      'inventory', 'shop', 'store', 'form', 'survey', 'quiz', 'game',
      'notes', 'diary', 'journal', 'budget', 'expense', 'finance'
    ];
    
    const found: string[] = [];
    for (const keyword of keywordPatterns) {
      if (text.includes(keyword)) {
        found.push(keyword);
      }
    }
    
    return found;
  }
  
  private determineIntent(text: string, keywords: string[]): string {
    // Map keywords to intents
    const intentMappings: Record<string, string[]> = {
      'productivity': ['todo', 'task', 'list', 'tracker', 'schedule', 'calendar'],
      'analytics': ['dashboard', 'analytics', 'metrics', 'charts', 'reports'],
      'content': ['blog', 'article', 'notes', 'diary', 'journal'],
      'social': ['social', 'chat', 'message', 'feed', 'profile'],
      'commerce': ['shop', 'store', 'inventory', 'product', 'cart'],
      'data_collection': ['form', 'survey', 'quiz', 'feedback'],
      'finance': ['budget', 'expense', 'finance', 'money', 'payment']
    };
    
    for (const [intent, intentKeywords] of Object.entries(intentMappings)) {
      if (keywords.some(k => intentKeywords.includes(k))) {
        return intent;
      }
    }
    
    return 'general';
  }
  
  private extractEntities(prompt: string): Record<string, string> {
    const entities: Record<string, string> = {};
    
    // Extract app name if mentioned
    const nameMatch = prompt.match(/(?:called|named|title[d]?)\s+["']?([^"']+)["']?/i);
    if (nameMatch) {
      entities.appName = nameMatch[1];
    }
    
    // Extract color scheme if mentioned
    const colorMatch = prompt.match(/\b(dark|light|blue|green|red|purple)\s+(?:theme|mode|color)/i);
    if (colorMatch) {
      entities.colorScheme = colorMatch[1];
    }
    
    // Extract target audience
    const audienceMatch = prompt.match(/for\s+(students|teachers|developers|designers|businesses)/i);
    if (audienceMatch) {
      entities.targetAudience = audienceMatch[1];
    }
    
    return entities;
  }
  
  private generateTags(keywords: string[], intent: string): string[] {
    const tags = [...keywords];
    
    // Add intent-based tags
    const intentTags: Record<string, string[]> = {
      'productivity': ['productivity', 'organization', 'efficiency'],
      'analytics': ['data', 'visualization', 'monitoring'],
      'content': ['writing', 'publishing', 'cms'],
      'social': ['communication', 'networking', 'sharing'],
      'commerce': ['selling', 'buying', 'transactions'],
      'data_collection': ['forms', 'input', 'collection'],
      'finance': ['money', 'tracking', 'calculations']
    };
    
    if (intentTags[intent]) {
      tags.push(...intentTags[intent]);
    }
    
    return [...new Set(tags)]; // Remove duplicates
  }
  
  private selectTemplate(analysis: {
    keywords: string[];
    intent: string;
    entities: Record<string, string>;
    tags: string[];
  }): AppTemplate | null {
    // First try to find by keywords
    const keywordMatches = this.templateLoader.findTemplatesByKeywords(analysis.keywords);
    if (keywordMatches.length > 0) {
      return keywordMatches[0];
    }
    
    // Then try to find by AI tags
    const tagMatch = this.templateLoader.findTemplateByAITags(analysis.tags);
    if (tagMatch) {
      return tagMatch;
    }
    
    // Finally, try to match by intent
    const intentTemplateMap: Record<string, string> = {
      'productivity': 'todo-app',
      'analytics': 'dashboard-app',
      'content': 'blog-app',
      'general': 'generic-app'
    };
    
    const templateId = intentTemplateMap[analysis.intent];
    if (templateId) {
      return this.templateLoader.getTemplate(templateId) || null;
    }
    
    return null;
  }
  
  private extractCustomVariables(
    prompt: string,
    analysis: any
  ): Record<string, any> {
    const variables: Record<string, any> = {};
    
    // Use extracted entities
    if (analysis.entities.appName) {
      variables.appTitle = analysis.entities.appName;
    }
    
    // Customize based on prompt length and complexity
    if (prompt.length > 100) {
      variables.description = prompt.substring(0, 150) + '...';
    } else {
      variables.description = prompt;
    }
    
    // Add welcome message
    variables.welcomeMessage = `Welcome to ${variables.appTitle || 'your app'}`;
    
    return variables;
  }
  
  private processComponents(
    template: AppTemplate,
    analysis: any
  ): AppTemplate {
    const processed = { ...template };
    
    // Apply rules to each screen
    for (const screen of processed.screens) {
      // Apply component selection rules
      screen.components = this.ruleEngine.applyComponentRules(
        screen.components,
        {
          hasDatabase: template.enableDatabase,
          screenLayout: screen.layout,
          userIntent: analysis.intent
        }
      );
      
      // Handle component fallbacks
      screen.components = this.resolveComponentFallbacks(screen.components);
      
      // Sort components by order
      screen.components.sort((a, b) => (a.order || 0) - (b.order || 0));
    }
    
    return processed;
  }
  
  private resolveComponentFallbacks(components: ComponentDefinition[]): ComponentDefinition[] {
    const resolved: ComponentDefinition[] = [];
    
    for (const component of components) {
      // Check if component is available
      const schema = this.componentMapper.findComponentByType(component.type);
      
      if (schema) {
        resolved.push(component);
      } else if (component.fallback) {
        // Use fallback component(s)
        if (Array.isArray(component.fallback)) {
          resolved.push(...component.fallback);
        } else {
          resolved.push(component.fallback);
        }
      } else {
        console.warn(`Component ${component.type} not found and no fallback provided`);
      }
    }
    
    return resolved;
  }
  
  private convertToAppSpec(template: AppTemplate): AppSpec {
    const spec: AppSpec = {
      appName: template.name,
      screens: []
    };
    
    if (template.enableDatabase) {
      spec.enableDatabase = true;
      spec.dataCollection = template.dataCollection;
    }
    
    for (const screen of template.screens) {
      const screenSpec: ScreenSpec = {
        name: screen.name,
        components: screen.components.map(comp => ({
          type: comp.type,
          props: this.processProps(comp.props)
        }))
      };
      spec.screens.push(screenSpec);
    }
    
    return spec;
  }
  
  private processProps(props: Record<string, any>): Record<string, any> {
    const processed: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(props)) {
      // Handle special prop values
      if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
        // This should have been interpolated already, use as-is
        processed[key] = value;
      } else {
        processed[key] = value;
      }
    }
    
    return processed;
  }
  
  private generateFromGenericTemplate(
    prompt: string,
    analysis: any
  ): AppSpec {
    const genericTemplate = this.templateLoader.getTemplate('generic-app');
    if (!genericTemplate) {
      return this.generateDefaultApp(prompt);
    }
    
    const customVariables = {
      appTitle: analysis.entities.appName || 'Generated App',
      welcomeMessage: 'Welcome',
      description: `App generated from: "${prompt}"`
    };
    
    const customized = this.templateLoader.interpolateTemplate(genericTemplate, customVariables);
    return this.convertToAppSpec(customized);
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
  
  // Public methods for testing and debugging
  public getTemplateLoader(): TemplateLoader {
    return this.templateLoader;
  }
  
  public getComponentMapper(): ComponentMapper {
    return this.componentMapper;
  }
  
  public getRuleEngine(): RuleEngine {
    return this.ruleEngine;
  }
}