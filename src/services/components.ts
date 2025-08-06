// Simplified component mapping - no complex classes or caching
import { componentSchemas, ComponentSchema } from '../schemas/component-schema';

export interface ComponentMatch {
  component: ComponentSchema;
  score: number;
}

// Simple component lookup functions
export function getComponentByType(type: string): ComponentSchema | undefined {
  return componentSchemas.find(c => c.type === type);
}

export function getAllComponents(): ComponentSchema[] {
  return [...componentSchemas];
}

export function findComponentsByTags(tags: string[]): ComponentMatch[] {
  const matches: ComponentMatch[] = [];
  const lowerTags = tags.map(t => t.toLowerCase());
  
  for (const component of componentSchemas) {
    const componentTags = component.aiTags.map(t => t.toLowerCase());
    let score = 0;
    
    // Calculate score based on tag matches
    for (const tag of lowerTags) {
      if (componentTags.includes(tag)) {
        score += 2; // Exact match
      } else if (componentTags.some(ct => ct.includes(tag) || tag.includes(ct))) {
        score += 1; // Partial match
      }
    }
    
    if (score > 0) {
      matches.push({ component, score });
    }
  }
  
  // Sort by score descending
  return matches.sort((a, b) => b.score - a.score);
}

export function findBestComponentByTags(tags: string[]): ComponentSchema | null {
  const matches = findComponentsByTags(tags);
  return matches.length > 0 ? matches[0].component : null;
}

export function findComponentsByKeywords(keywords: string[]): ComponentSchema[] {
  const lowerKeywords = keywords.map(k => k.toLowerCase());
  
  return componentSchemas.filter(component => {
    const searchText = [
      component.name.toLowerCase(),
      component.description.toLowerCase(),
      ...component.aiTags.map(t => t.toLowerCase())
    ].join(' ');
    
    return lowerKeywords.some(keyword => searchText.includes(keyword));
  });
}

export function getComponentsByCategory(category: ComponentSchema['category']): ComponentSchema[] {
  return componentSchemas.filter(c => c.category === category);
}

// Simple intent mapping
export function findComponentByIntent(intent: string): ComponentSchema | null {
  const intentMappings: Record<string, string[]> = {
    'display_text': ['Header', 'Card'],
    'display_list': ['List', 'DataList'],
    'input_text': ['TextInput'],
    'input_form': ['DataForm'],
    'action': ['Button'],
    'navigation': ['Header'],
    'container': ['Card'],
    'data_collection': ['DataForm'],
    'data_display': ['DataList', 'List']
  };
  
  const componentTypes = intentMappings[intent];
  if (!componentTypes) return null;
  
  // Return the first available component type
  for (const type of componentTypes) {
    const component = getComponentByType(type);
    if (component) return component;
  }
  
  return null;
}

// Simple component validation
export function validateComponentExists(type: string): boolean {
  return componentSchemas.some(c => c.type === type);
}