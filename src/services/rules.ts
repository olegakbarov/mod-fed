// Simplified rule engine - just essential functionality
import { ComponentDefinition } from './templates';

export interface RuleContext {
  hasDatabase?: boolean;
  screenLayout?: string;
  userIntent?: string;
  componentCount?: number;
  platform?: 'ios' | 'android' | 'web';
  screenCount?: number;
}

export interface Rule {
  id: string;
  name: string;
  condition: (context: RuleContext) => boolean;
  action: (components: ComponentDefinition[], context: RuleContext) => ComponentDefinition[];
}

// Simple predefined rules - no complex configuration system
const DEFAULT_RULES: Rule[] = [
  // Remove data components if no database
  {
    id: 'require-database',
    name: 'Database Required',
    condition: (context) => !context.hasDatabase,
    action: (components) => components.filter(comp => 
      comp.type !== 'DataForm' && comp.type !== 'DataList'
    )
  },
  
  // Limit components for mobile
  {
    id: 'mobile-limit',
    name: 'Mobile Limit',
    condition: (context) => 
      (context.platform === 'ios' || context.platform === 'android') &&
      (context.componentCount || 0) > 5,
    action: (components) => components.slice(0, 5)
  },
  
  // Ensure header is first
  {
    id: 'header-first',
    name: 'Header First',
    condition: () => true,
    action: (components) => {
      const header = components.find(c => c.type === 'Header');
      if (header) {
        const others = components.filter(c => c.type !== 'Header');
        return [header, ...others];
      }
      return components;
    }
  },
  
  // Convert list to cards for grid layout
  {
    id: 'grid-cards',
    name: 'Grid Cards',
    condition: (context) => context.screenLayout === 'grid',
    action: (components) => {
      return components.flatMap(comp => {
        if (comp.type === 'List' && comp.props?.items && Array.isArray(comp.props.items)) {
          // Convert list items to individual cards (max 4)
          const items = comp.props.items.slice(0, 4);
          return items.map((item: any, index: number) => ({
            type: 'Card',
            props: {
              title: item.title || `Item ${index + 1}`,
              content: item.content || item.description || ''
            },
            order: comp.order
          }));
        }
        return comp;
      });
    }
  }
];

// Simple rule application
export function applyRules(components: ComponentDefinition[], context: RuleContext): ComponentDefinition[] {
  let result = [...components];
  
  // Add component count to context
  context.componentCount = result.length;
  
  // Apply each rule in order
  for (const rule of DEFAULT_RULES) {
    if (rule.condition(context)) {
      try {
        result = rule.action(result, context);
      } catch (error) {
        console.error(`Error applying rule ${rule.name}:`, error);
      }
    }
  }
  
  return result;
}

// Simple rule management
export function addRule(rule: Rule): void {
  DEFAULT_RULES.push(rule);
}

export function getRules(): Rule[] {
  return [...DEFAULT_RULES];
}