import { ComponentSchema, componentSchemas } from '../schemas/component-schema';

export interface ComponentMatch {
  component: ComponentSchema;
  score: number;
  reason: string;
}

export class ComponentMapper {
  private componentCache: Map<string, ComponentSchema> = new Map();
  private tagIndex: Map<string, ComponentSchema[]> = new Map();
  
  constructor() {
    this.buildIndices();
  }
  
  private buildIndices(): void {
    // Build component cache
    for (const schema of componentSchemas) {
      this.componentCache.set(schema.type, schema);
      
      // Build tag index for faster lookups
      for (const tag of schema.aiTags) {
        const existing = this.tagIndex.get(tag) || [];
        existing.push(schema);
        this.tagIndex.set(tag, existing);
      }
    }
  }
  
  public findComponentByType(type: string): ComponentSchema | undefined {
    return this.componentCache.get(type);
  }
  
  public findComponentsByTags(tags: string[]): ComponentMatch[] {
    const matches: Map<string, ComponentMatch> = new Map();
    
    for (const tag of tags) {
      const components = this.tagIndex.get(tag.toLowerCase()) || [];
      
      for (const component of components) {
        const existing = matches.get(component.id);
        if (existing) {
          existing.score += 1;
        } else {
          matches.set(component.id, {
            component,
            score: 1,
            reason: `Matched tag: ${tag}`
          });
        }
      }
    }
    
    // Sort by score descending
    return Array.from(matches.values()).sort((a, b) => b.score - a.score);
  }
  
  public findComponentByIntent(intent: string): ComponentSchema | null {
    const intentMappings: Record<string, string[]> = {
      'display_text': ['Header', 'Card', 'Text'],
      'display_list': ['List', 'DataList'],
      'input_text': ['TextInput'],
      'input_form': ['DataForm'],
      'action': ['Button'],
      'navigation': ['Header', 'TabNavigator'],
      'container': ['Card', 'View'],
      'data_collection': ['DataForm'],
      'data_display': ['DataList', 'List']
    };
    
    const componentTypes = intentMappings[intent];
    if (!componentTypes || componentTypes.length === 0) {
      return null;
    }
    
    // Return the first available component
    for (const type of componentTypes) {
      const component = this.findComponentByType(type);
      if (component) {
        return component;
      }
    }
    
    return null;
  }
  
  public suggestComponents(context: {
    previousComponent?: string;
    screenLayout?: string;
    hasDatabase?: boolean;
    userIntent?: string;
  }): ComponentSchema[] {
    const suggestions: ComponentSchema[] = [];
    
    // Context-based suggestions
    if (!context.previousComponent) {
      // First component is usually a header
      const header = this.findComponentByType('Header');
      if (header) suggestions.push(header);
    }
    
    if (context.hasDatabase) {
      // Suggest data components
      const dataForm = this.findComponentByType('DataForm');
      const dataList = this.findComponentByType('DataList');
      if (dataForm) suggestions.push(dataForm);
      if (dataList) suggestions.push(dataList);
    }
    
    if (context.screenLayout === 'grid') {
      // Suggest card components for grid layouts
      const card = this.findComponentByType('Card');
      if (card) suggestions.push(card);
    }
    
    if (context.userIntent) {
      // Intent-based suggestions
      const intentComponent = this.findComponentByIntent(context.userIntent);
      if (intentComponent && !suggestions.find(s => s.id === intentComponent.id)) {
        suggestions.push(intentComponent);
      }
    }
    
    return suggestions;
  }
  
  public validateComponentCompatibility(
    component: ComponentSchema,
    context: {
      platform?: 'ios' | 'android' | 'web';
      requiredCapabilities?: string[];
    }
  ): { compatible: boolean; issues: string[] } {
    const issues: string[] = [];
    
    // Check platform compatibility
    if (context.platform && component.compatibility?.platforms) {
      if (!component.compatibility.platforms.includes(context.platform)) {
        issues.push(`Component not compatible with ${context.platform}`);
      }
    }
    
    // Check required capabilities
    if (context.requiredCapabilities && component.capabilities) {
      for (const required of context.requiredCapabilities) {
        if (!component.capabilities.includes(required)) {
          issues.push(`Component lacks required capability: ${required}`);
        }
      }
    }
    
    return {
      compatible: issues.length === 0,
      issues
    };
  }
  
  public resolveComponentDependencies(component: ComponentSchema): ComponentSchema[] {
    const resolved: ComponentSchema[] = [];
    const visited = new Set<string>();
    
    const resolveDeps = (comp: ComponentSchema) => {
      if (visited.has(comp.id)) return;
      visited.add(comp.id);
      
      if (comp.dependencies) {
        for (const depType of comp.dependencies) {
          const dep = this.findComponentByType(depType);
          if (dep) {
            resolveDeps(dep);
          }
        }
      }
      
      resolved.push(comp);
    };
    
    resolveDeps(component);
    return resolved;
  }
  
  public rankComponentsByRelevance(
    components: ComponentSchema[],
    keywords: string[]
  ): ComponentSchema[] {
    const scored = components.map(component => {
      let score = 0;
      const lowerKeywords = keywords.map(k => k.toLowerCase());
      
      // Check AI tags
      for (const tag of component.aiTags) {
        if (lowerKeywords.includes(tag.toLowerCase())) {
          score += 3; // Exact tag match
        } else if (lowerKeywords.some(k => tag.toLowerCase().includes(k))) {
          score += 1; // Partial tag match
        }
      }
      
      // Check description
      const lowerDesc = component.description.toLowerCase();
      for (const keyword of lowerKeywords) {
        if (lowerDesc.includes(keyword)) {
          score += 1;
        }
      }
      
      // Check name
      if (lowerKeywords.includes(component.name.toLowerCase())) {
        score += 2;
      }
      
      return { component, score };
    });
    
    // Sort by score descending
    return scored
      .sort((a, b) => b.score - a.score)
      .map(item => item.component);
  }
  
  public getAllComponents(): ComponentSchema[] {
    return Array.from(this.componentCache.values());
  }
  
  public getComponentsByCategory(category: string): ComponentSchema[] {
    return this.getAllComponents().filter(c => c.category === category);
  }
}