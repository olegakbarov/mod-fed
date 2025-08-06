import { ComponentDefinition } from './template-loader';

export interface Rule {
  id: string;
  name: string;
  description: string;
  condition: (context: RuleContext) => boolean;
  action: (components: ComponentDefinition[], context: RuleContext) => ComponentDefinition[];
  priority: number;
}

export interface RuleContext {
  hasDatabase?: boolean;
  screenLayout?: string;
  userIntent?: string;
  componentCount?: number;
  platform?: 'ios' | 'android' | 'web';
  [key: string]: any;
}

export class RuleEngine {
  private rules: Rule[] = [];
  
  constructor() {
    this.initializeDefaultRules();
  }
  
  private initializeDefaultRules(): void {
    // Rule: Add data components only if database is enabled
    this.addRule({
      id: 'require-database',
      name: 'Database Required',
      description: 'Remove data components if database is not enabled',
      priority: 10,
      condition: (context) => !context.hasDatabase,
      action: (components) => {
        return components.filter(comp => 
          comp.type !== 'DataForm' && comp.type !== 'DataList'
        );
      }
    });
    
    // Rule: Limit components for mobile platforms
    this.addRule({
      id: 'mobile-optimization',
      name: 'Mobile Optimization',
      description: 'Optimize component count for mobile platforms',
      priority: 5,
      condition: (context) => 
        (context.platform === 'ios' || context.platform === 'android') &&
        (context.componentCount || 0) > 5,
      action: (components) => {
        // Keep only the first 5 most important components
        return components
          .sort((a, b) => (a.order || 999) - (b.order || 999))
          .slice(0, 5);
      }
    });
    
    // Rule: Add navigation for multi-screen apps
    this.addRule({
      id: 'multi-screen-navigation',
      name: 'Multi-Screen Navigation',
      description: 'Add navigation components for multi-screen apps',
      priority: 8,
      condition: (context) => context.screenCount > 1,
      action: (components) => {
        // Check if navigation component exists
        const hasNavigation = components.some(c => 
          c.type === 'TabNavigator' || c.type === 'Drawer'
        );
        
        if (!hasNavigation) {
          // Add tab navigator at the end
          components.push({
            type: 'TabNavigator',
            props: { tabs: [] },
            order: 100
          });
        }
        
        return components;
      }
    });
    
    // Rule: Ensure header is first
    this.addRule({
      id: 'header-first',
      name: 'Header First',
      description: 'Ensure header component is always first',
      priority: 9,
      condition: (context) => true,
      action: (components) => {
        const header = components.find(c => c.type === 'Header');
        if (header) {
          // Remove header from current position
          const filtered = components.filter(c => c.type !== 'Header');
          // Add header at the beginning
          return [header, ...filtered];
        }
        return components;
      }
    });
    
    // Rule: Add form validation for data collection
    this.addRule({
      id: 'form-validation',
      name: 'Form Validation',
      description: 'Add validation to form components',
      priority: 6,
      condition: (context) => context.userIntent === 'data_collection',
      action: (components) => {
        return components.map(comp => {
          if (comp.type === 'DataForm' && comp.props) {
            // Add validation flag
            comp.props.enableValidation = true;
            comp.props.validateOnSubmit = true;
          }
          return comp;
        });
      }
    });
    
    // Rule: Optimize grid layout
    this.addRule({
      id: 'grid-optimization',
      name: 'Grid Layout Optimization',
      description: 'Optimize components for grid layout',
      priority: 7,
      condition: (context) => context.screenLayout === 'grid',
      action: (components) => {
        // Convert list components to cards for grid layout
        return components.map(comp => {
          if (comp.type === 'List' && comp.props?.items) {
            // Convert to multiple cards
            const cards: ComponentDefinition[] = [];
            const items = comp.props.items.slice(0, 4); // Limit to 4 for grid
            
            items.forEach((item: any, index: number) => {
              cards.push({
                type: 'Card',
                props: {
                  title: item.title || `Item ${index + 1}`,
                  content: item.content || item.description || ''
                },
                order: comp.order
              });
            });
            
            return cards;
          }
          return comp;
        }).flat();
      }
    });
    
    // Rule: Add loading states for async components
    this.addRule({
      id: 'async-loading',
      name: 'Async Loading States',
      description: 'Add loading states to data components',
      priority: 4,
      condition: (context) => context.hasDatabase,
      action: (components) => {
        return components.map(comp => {
          if (comp.type === 'DataList' || comp.type === 'DataForm') {
            comp.props = {
              ...comp.props,
              showLoadingState: true,
              loadingText: 'Loading...'
            };
          }
          return comp;
        });
      }
    });
    
    // Rule: Responsive design adjustments
    this.addRule({
      id: 'responsive-design',
      name: 'Responsive Design',
      description: 'Adjust components for responsive design',
      priority: 3,
      condition: (context) => context.platform === 'web',
      action: (components) => {
        return components.map(comp => {
          // Add responsive props for web
          if (comp.type === 'Card' || comp.type === 'List') {
            comp.props = {
              ...comp.props,
              responsive: true,
              breakpoints: {
                mobile: 320,
                tablet: 768,
                desktop: 1024
              }
            };
          }
          return comp;
        });
      }
    });
  }
  
  public addRule(rule: Rule): void {
    this.rules.push(rule);
    // Keep rules sorted by priority (higher priority first)
    this.rules.sort((a, b) => b.priority - a.priority);
  }
  
  public removeRule(ruleId: string): boolean {
    const index = this.rules.findIndex(r => r.id === ruleId);
    if (index !== -1) {
      this.rules.splice(index, 1);
      return true;
    }
    return false;
  }
  
  public applyRules(
    components: ComponentDefinition[],
    context: RuleContext
  ): ComponentDefinition[] {
    let processedComponents = [...components];
    
    // Add component count to context
    context.componentCount = processedComponents.length;
    
    // Apply each rule in priority order
    for (const rule of this.rules) {
      if (rule.condition(context)) {
        try {
          processedComponents = rule.action(processedComponents, context);
          console.log(`Applied rule: ${rule.name}`);
        } catch (error) {
          console.error(`Error applying rule ${rule.name}:`, error);
        }
      }
    }
    
    return processedComponents;
  }
  
  public applyComponentRules(
    components: ComponentDefinition[],
    context: RuleContext
  ): ComponentDefinition[] {
    // This is a convenience method that's called from the AI generator
    return this.applyRules(components, context);
  }
  
  public getRules(): Rule[] {
    return [...this.rules];
  }
  
  public getRuleById(ruleId: string): Rule | undefined {
    return this.rules.find(r => r.id === ruleId);
  }
  
  public validateRule(rule: Rule): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!rule.id) {
      errors.push('Rule must have an ID');
    }
    
    if (!rule.name) {
      errors.push('Rule must have a name');
    }
    
    if (typeof rule.condition !== 'function') {
      errors.push('Rule condition must be a function');
    }
    
    if (typeof rule.action !== 'function') {
      errors.push('Rule action must be a function');
    }
    
    if (typeof rule.priority !== 'number' || rule.priority < 0) {
      errors.push('Rule priority must be a non-negative number');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  public createCustomRule(config: {
    id: string;
    name: string;
    description: string;
    conditionCode: string;
    actionCode: string;
    priority: number;
  }): Rule | null {
    try {
      // Create condition function from code
      // Note: In production, this should use a safe sandbox
      const condition = new Function('context', conditionCode) as (context: RuleContext) => boolean;
      
      // Create action function from code
      const action = new Function('components', 'context', actionCode) as 
        (components: ComponentDefinition[], context: RuleContext) => ComponentDefinition[];
      
      const rule: Rule = {
        id: config.id,
        name: config.name,
        description: config.description,
        condition,
        action,
        priority: config.priority
      };
      
      const validation = this.validateRule(rule);
      if (validation.valid) {
        return rule;
      } else {
        console.error('Invalid rule:', validation.errors);
        return null;
      }
    } catch (error) {
      console.error('Error creating custom rule:', error);
      return null;
    }
  }
}