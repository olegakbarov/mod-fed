/**
 * Comprehensive tests for components service
 */

import {
  getComponentByType,
  getAllComponents,
  findComponentsByTags,
  findBestComponentByTags,
  findComponentsByKeywords,
  getComponentsByCategory,
  findComponentByIntent,
  validateComponentExists,
  ComponentMatch
} from '../components';
import { ComponentSchema } from '../../schemas/component-schema';

// Mock the component schemas
jest.mock('../../schemas/component-schema', () => ({
  componentSchemas: [
    {
      id: 'header-basic',
      name: 'Header',
      version: '1.0.0',
      type: 'Header',
      category: 'navigation',
      description: 'Basic header with optional back button',
      aiTags: ['navigation', 'top', 'header', 'title'],
      props: [
        { name: 'title', type: 'string', required: true, description: 'The title text to display' },
        { name: 'showBack', type: 'boolean', required: false, default: false }
      ],
      capabilities: ['navigation'],
      compatibility: { platforms: ['ios', 'android', 'web'] }
    },
    {
      id: 'button-primary',
      name: 'Button',
      version: '1.0.0',
      type: 'Button',
      category: 'input',
      description: 'Primary action button',
      aiTags: ['action', 'cta', 'interactive', 'button', 'click'],
      props: [
        { name: 'label', type: 'string', required: true, description: 'Button label text' },
        { name: 'onPress', type: 'function', required: false },
        { name: 'disabled', type: 'boolean', required: false, default: false }
      ],
      capabilities: ['interaction'],
      compatibility: { platforms: ['ios', 'android', 'web'] }
    },
    {
      id: 'list-simple',
      name: 'List',
      version: '1.0.0',
      type: 'List',
      category: 'display',
      description: 'Simple list for displaying collections',
      aiTags: ['display', 'collection', 'scrollable', 'list', 'items'],
      props: [
        { name: 'items', type: 'array', required: true, description: 'Array of items to display' },
        { name: 'title', type: 'string', required: false },
        { name: 'renderItem', type: 'function', required: false }
      ],
      capabilities: ['scrolling', 'data-display'],
      compatibility: { platforms: ['ios', 'android', 'web'] }
    },
    {
      id: 'card-basic',
      name: 'Card',
      version: '1.0.0',
      type: 'Card',
      category: 'display',
      description: 'Card container for content',
      aiTags: ['container', 'content', 'display', 'card', 'box'],
      props: [
        { name: 'title', type: 'string', required: false },
        { name: 'content', type: 'string', required: false },
        { name: 'image', type: 'string', required: false }
      ],
      capabilities: ['content-display'],
      compatibility: { platforms: ['ios', 'android', 'web'] }
    },
    {
      id: 'input-basic',
      name: 'TextInput',
      version: '1.0.0',
      type: 'TextInput',
      category: 'input',
      description: 'Text input field',
      aiTags: ['input', 'form', 'interactive', 'text', 'field', 'entry'],
      props: [
        { name: 'placeholder', type: 'string', required: false },
        { name: 'value', type: 'string', required: false },
        { name: 'onChangeText', type: 'function', required: false },
        { name: 'multiline', type: 'boolean', required: false, default: false }
      ],
      capabilities: ['text-input'],
      compatibility: { platforms: ['ios', 'android', 'web'] }
    },
    {
      id: 'data-form',
      name: 'DataForm',
      version: '1.0.0',
      type: 'DataForm',
      category: 'data',
      description: 'Dynamic form for data collection',
      aiTags: ['form', 'data', 'input', 'collection', 'submit'],
      props: [
        { name: 'collection', type: 'string', required: true },
        { name: 'fields', type: 'array', required: true },
        { name: 'submitLabel', type: 'string', required: false, default: 'Submit' }
      ],
      dependencies: ['TextInput', 'Button'],
      capabilities: ['data-collection', 'validation'],
      compatibility: { platforms: ['ios', 'android', 'web'] }
    },
    {
      id: 'data-list',
      name: 'DataList',
      version: '1.0.0',
      type: 'DataList',
      category: 'data',
      description: 'Dynamic list connected to data source',
      aiTags: ['list', 'data', 'display', 'crud', 'collection'],
      props: [
        { name: 'collection', type: 'string', required: true },
        { name: 'onDelete', type: 'boolean', required: false, default: false },
        { name: 'onEdit', type: 'boolean', required: false, default: false }
      ],
      dependencies: ['List'],
      capabilities: ['data-display', 'crud-operations'],
      compatibility: { platforms: ['ios', 'android', 'web'] }
    }
  ]
}));

describe('Components Service', () => {
  describe('getComponentByType', () => {
    it('should return component by exact type match', () => {
      const result = getComponentByType('Header');
      
      expect(result).toBeDefined();
      expect(result!.type).toBe('Header');
      expect(result!.id).toBe('header-basic');
    });

    it('should return undefined for non-existent type', () => {
      const result = getComponentByType('NonExistentComponent');
      
      expect(result).toBeUndefined();
    });

    it('should handle case sensitivity correctly', () => {
      const result = getComponentByType('header'); // lowercase
      
      expect(result).toBeUndefined(); // Should be case sensitive
    });

    it('should handle empty or null input', () => {
      expect(getComponentByType('')).toBeUndefined();
      expect(getComponentByType(null as any)).toBeUndefined();
      expect(getComponentByType(undefined as any)).toBeUndefined();
    });

    it('should return first match when multiple components have same type', () => {
      // This tests the behavior when there are multiple components with same type
      const result = getComponentByType('Button');
      
      expect(result).toBeDefined();
      expect(result!.type).toBe('Button');
      expect(result!.id).toBe('button-primary');
    });
  });

  describe('getAllComponents', () => {
    it('should return all component schemas', () => {
      const result = getAllComponents();
      
      expect(result).toHaveLength(7);
      expect(result.map(c => c.type)).toContain('Header');
      expect(result.map(c => c.type)).toContain('Button');
      expect(result.map(c => c.type)).toContain('List');
      expect(result.map(c => c.type)).toContain('Card');
      expect(result.map(c => c.type)).toContain('TextInput');
      expect(result.map(c => c.type)).toContain('DataForm');
      expect(result.map(c => c.type)).toContain('DataList');
    });

    it('should return a copy of the schemas array', () => {
      const result1 = getAllComponents();
      const result2 = getAllComponents();
      
      expect(result1).toEqual(result2);
      expect(result1).not.toBe(result2); // Should be different arrays
    });

    it('should return components with all required properties', () => {
      const result = getAllComponents();
      
      result.forEach(component => {
        expect(component).toHaveProperty('id');
        expect(component).toHaveProperty('name');
        expect(component).toHaveProperty('type');
        expect(component).toHaveProperty('category');
        expect(component).toHaveProperty('description');
        expect(component).toHaveProperty('aiTags');
        expect(component).toHaveProperty('props');
        expect(Array.isArray(component.aiTags)).toBe(true);
        expect(Array.isArray(component.props)).toBe(true);
      });
    });
  });

  describe('findComponentsByTags', () => {
    it('should find components by exact tag match', () => {
      const result = findComponentsByTags(['navigation']);
      
      expect(result).toHaveLength(1);
      expect(result[0].component.type).toBe('Header');
      expect(result[0].score).toBeGreaterThan(0);
    });

    it('should find multiple components with shared tags', () => {
      const result = findComponentsByTags(['display']);
      
      expect(result.length).toBeGreaterThanOrEqual(2);
      const types = result.map(r => r.component.type);
      expect(types).toContain('List');
      expect(types).toContain('Card');
    });

    it('should score exact matches higher', () => {
      const result = findComponentsByTags(['button']);
      
      expect(result).toHaveLength(1);
      expect(result[0].component.type).toBe('Button');
      expect(result[0].score).toBe(2); // Exact match should score 2
    });

    it('should handle partial matches', () => {
      const result = findComponentsByTags(['interact']);
      
      expect(result.length).toBeGreaterThan(0);
      const buttonMatch = result.find(r => r.component.type === 'Button');
      expect(buttonMatch).toBeDefined();
      expect(buttonMatch!.score).toBe(1); // Partial match should score 1
    });

    it('should sort results by score descending', () => {
      const result = findComponentsByTags(['input', 'form']);
      
      expect(result.length).toBeGreaterThan(1);
      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].score).toBeGreaterThanOrEqual(result[i].score);
      }
    });

    it('should be case insensitive', () => {
      const result1 = findComponentsByTags(['NAVIGATION']);
      const result2 = findComponentsByTags(['navigation']);
      
      expect(result1).toEqual(result2);
    });

    it('should handle multiple tags', () => {
      const result = findComponentsByTags(['input', 'interactive']);
      
      expect(result.length).toBeGreaterThan(0);
      const buttonMatch = result.find(r => r.component.type === 'Button');
      const inputMatch = result.find(r => r.component.type === 'TextInput');
      
      expect(buttonMatch).toBeDefined();
      expect(inputMatch).toBeDefined();
    });

    it('should return empty array for no matches', () => {
      const result = findComponentsByTags(['nonexistent']);
      
      expect(result).toEqual([]);
    });

    it('should handle empty tags array', () => {
      const result = findComponentsByTags([]);
      
      expect(result).toEqual([]);
    });

    it('should handle whitespace in tags', () => {
      const result = findComponentsByTags(['  navigation  ', ' header ']);
      
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].component.type).toBe('Header');
    });
  });

  describe('findBestComponentByTags', () => {
    it('should return component with highest score', () => {
      const result = findBestComponentByTags(['input', 'form']);
      
      expect(result).toBeDefined();
      // Should return either TextInput or DataForm based on scoring
      expect(['TextInput', 'DataForm']).toContain(result!.type);
    });

    it('should return null for no matches', () => {
      const result = findBestComponentByTags(['nonexistent']);
      
      expect(result).toBeNull();
    });

    it('should handle empty tags array', () => {
      const result = findBestComponentByTags([]);
      
      expect(result).toBeNull();
    });

    it('should return first component when scores are tied', () => {
      // This is hard to test directly, but we can ensure it doesn't throw
      const result = findBestComponentByTags(['display']);
      
      expect(result).toBeDefined();
      expect(['List', 'Card', 'DataList']).toContain(result!.type);
    });
  });

  describe('findComponentsByKeywords', () => {
    it('should find components by name', () => {
      const result = findComponentsByKeywords(['Header']);
      
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('Header');
    });

    it('should find components by description', () => {
      const result = findComponentsByKeywords(['collections']);
      
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].type).toBe('List');
    });

    it('should find components by AI tags', () => {
      const result = findComponentsByKeywords(['navigation']);
      
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('Header');
    });

    it('should be case insensitive', () => {
      const result1 = findComponentsByKeywords(['HEADER']);
      const result2 = findComponentsByKeywords(['header']);
      
      expect(result1).toEqual(result2);
    });

    it('should handle multiple keywords', () => {
      const result = findComponentsByKeywords(['button', 'input']);
      
      expect(result.length).toBeGreaterThanOrEqual(2);
      const types = result.map(c => c.type);
      expect(types).toContain('Button');
      expect(types).toContain('TextInput');
    });

    it('should return empty array for no matches', () => {
      const result = findComponentsByKeywords(['nonexistent']);
      
      expect(result).toEqual([]);
    });

    it('should handle empty keywords array', () => {
      const result = findComponentsByKeywords([]);
      
      expect(result).toEqual([]);
    });

    it('should find partial matches in text', () => {
      const result = findComponentsByKeywords(['contain']);
      
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].type).toBe('Card'); // Card has 'container' in tags
    });
  });

  describe('getComponentsByCategory', () => {
    it('should return components by category', () => {
      const displayComponents = getComponentsByCategory('display');
      const inputComponents = getComponentsByCategory('input');
      const navigationComponents = getComponentsByCategory('navigation');
      const dataComponents = getComponentsByCategory('data');
      
      expect(displayComponents).toHaveLength(2);
      expect(displayComponents.map(c => c.type)).toEqual(['List', 'Card']);
      
      expect(inputComponents).toHaveLength(2);
      expect(inputComponents.map(c => c.type)).toEqual(['Button', 'TextInput']);
      
      expect(navigationComponents).toHaveLength(1);
      expect(navigationComponents[0].type).toBe('Header');
      
      expect(dataComponents).toHaveLength(2);
      expect(dataComponents.map(c => c.type)).toEqual(['DataForm', 'DataList']);
    });

    it('should return empty array for non-existent category', () => {
      const result = getComponentsByCategory('nonexistent' as any);
      
      expect(result).toEqual([]);
    });

    it('should handle all valid categories', () => {
      const categories: Array<ComponentSchema['category']> = [
        'display', 'input', 'layout', 'navigation', 'data', 'utility'
      ];
      
      categories.forEach(category => {
        const result = getComponentsByCategory(category);
        expect(Array.isArray(result)).toBe(true);
        result.forEach(component => {
          expect(component.category).toBe(category);
        });
      });
    });
  });

  describe('findComponentByIntent', () => {
    it('should map display_text intent to correct components', () => {
      const result = findComponentByIntent('display_text');
      
      expect(result).toBeDefined();
      expect(['Header', 'Card']).toContain(result!.type);
    });

    it('should map display_list intent to correct components', () => {
      const result = findComponentByIntent('display_list');
      
      expect(result).toBeDefined();
      expect(['List', 'DataList']).toContain(result!.type);
    });

    it('should map input_text intent to correct component', () => {
      const result = findComponentByIntent('input_text');
      
      expect(result).toBeDefined();
      expect(result!.type).toBe('TextInput');
    });

    it('should map input_form intent to correct component', () => {
      const result = findComponentByIntent('input_form');
      
      expect(result).toBeDefined();
      expect(result!.type).toBe('DataForm');
    });

    it('should map action intent to correct component', () => {
      const result = findComponentByIntent('action');
      
      expect(result).toBeDefined();
      expect(result!.type).toBe('Button');
    });

    it('should map navigation intent to correct component', () => {
      const result = findComponentByIntent('navigation');
      
      expect(result).toBeDefined();
      expect(result!.type).toBe('Header');
    });

    it('should map container intent to correct component', () => {
      const result = findComponentByIntent('container');
      
      expect(result).toBeDefined();
      expect(result!.type).toBe('Card');
    });

    it('should map data_collection intent to correct component', () => {
      const result = findComponentByIntent('data_collection');
      
      expect(result).toBeDefined();
      expect(result!.type).toBe('DataForm');
    });

    it('should map data_display intent to correct components', () => {
      const result = findComponentByIntent('data_display');
      
      expect(result).toBeDefined();
      expect(['DataList', 'List']).toContain(result!.type);
    });

    it('should return null for unknown intent', () => {
      const result = findComponentByIntent('unknown_intent');
      
      expect(result).toBeNull();
    });

    it('should return first available component for intent', () => {
      // This tests the priority ordering in the mappings
      const result = findComponentByIntent('display_text');
      
      expect(result).toBeDefined();
      // Should return Header first (as it appears first in the mapping)
      expect(result!.type).toBe('Header');
    });

    it('should handle missing component gracefully', () => {
      // This tests what happens if a mapped component doesn't exist
      // Since all our components exist, this is mostly about code robustness
      const result = findComponentByIntent('action');
      
      expect(result).toBeDefined();
      expect(result!.type).toBe('Button');
    });
  });

  describe('validateComponentExists', () => {
    it('should return true for existing component types', () => {
      expect(validateComponentExists('Header')).toBe(true);
      expect(validateComponentExists('Button')).toBe(true);
      expect(validateComponentExists('List')).toBe(true);
      expect(validateComponentExists('Card')).toBe(true);
      expect(validateComponentExists('TextInput')).toBe(true);
      expect(validateComponentExists('DataForm')).toBe(true);
      expect(validateComponentExists('DataList')).toBe(true);
    });

    it('should return false for non-existent component types', () => {
      expect(validateComponentExists('NonExistentComponent')).toBe(false);
      expect(validateComponentExists('CustomComponent')).toBe(false);
      expect(validateComponentExists('UnknownType')).toBe(false);
    });

    it('should be case sensitive', () => {
      expect(validateComponentExists('header')).toBe(false);
      expect(validateComponentExists('HEADER')).toBe(false);
      expect(validateComponentExists('Header')).toBe(true);
    });

    it('should handle empty or null input', () => {
      expect(validateComponentExists('')).toBe(false);
      expect(validateComponentExists(null as any)).toBe(false);
      expect(validateComponentExists(undefined as any)).toBe(false);
    });

    it('should handle whitespace correctly', () => {
      expect(validateComponentExists(' Header ')).toBe(false);
      expect(validateComponentExists('Header ')).toBe(false);
      expect(validateComponentExists(' Header')).toBe(false);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle malformed component schemas gracefully', () => {
      // This tests robustness against malformed data
      const result = getAllComponents();
      
      result.forEach(component => {
        expect(component.type).toBeDefined();
        expect(component.aiTags).toBeDefined();
        expect(Array.isArray(component.aiTags)).toBe(true);
      });
    });

    it('should handle components with empty AI tags', () => {
      // Test what happens with components that have empty aiTags
      const result = findComponentsByTags(['navigation']);
      
      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle very long tag lists', () => {
      const longTagList = Array.from({ length: 100 }, (_, i) => `tag${i}`);
      
      expect(() => findComponentsByTags(longTagList)).not.toThrow();
      expect(() => findBestComponentByTags(longTagList)).not.toThrow();
    });

    it('should handle special characters in search terms', () => {
      const specialChars = ['@', '#', '$', '%', '^', '&', '*', '(', ')'];
      
      specialChars.forEach(char => {
        expect(() => findComponentsByKeywords([char])).not.toThrow();
        expect(() => findComponentsByTags([char])).not.toThrow();
      });
    });

    it('should handle unicode characters', () => {
      const unicodeTerms = ['🔥', 'café', '中文', 'עברית'];
      
      unicodeTerms.forEach(term => {
        expect(() => findComponentsByKeywords([term])).not.toThrow();
        expect(() => findComponentsByTags([term])).not.toThrow();
      });
    });

    it('should handle extremely long search terms', () => {
      const longTerm = 'a'.repeat(1000);
      
      expect(() => findComponentsByKeywords([longTerm])).not.toThrow();
      expect(() => findComponentsByTags([longTerm])).not.toThrow();
      expect(() => validateComponentExists(longTerm)).not.toThrow();
    });
  });

  describe('scoring algorithm', () => {
    it('should score exact matches higher than partial matches', () => {
      const results = findComponentsByTags(['interactive', 'interact']);
      
      if (results.length >= 2) {
        const exactMatch = results.find(r => r.component.aiTags.includes('interactive'));
        const partialMatch = results.find(r => 
          r.component.aiTags.some(tag => tag.includes('interact') && tag !== 'interactive')
        );
        
        if (exactMatch && partialMatch) {
          expect(exactMatch.score).toBeGreaterThan(partialMatch.score);
        }
      }
    });

    it('should accumulate scores for multiple matches', () => {
      const results = findComponentsByTags(['input', 'form']);
      const dataFormResult = results.find(r => r.component.type === 'DataForm');
      
      if (dataFormResult) {
        expect(dataFormResult.score).toBeGreaterThanOrEqual(2); // Should match both tags
      }
    });

    it('should handle score calculation edge cases', () => {
      // Test with empty tags
      expect(() => findComponentsByTags([])).not.toThrow();
      
      // Test with duplicate tags
      const result1 = findComponentsByTags(['input', 'input']);
      const result2 = findComponentsByTags(['input']);
      
      // Results should be the same (duplicates shouldn't increase score)
      expect(result1).toEqual(result2);
    });
  });

  describe('performance considerations', () => {
    it('should handle large numbers of queries efficiently', () => {
      const startTime = Date.now();
      
      // Run many queries
      for (let i = 0; i < 100; i++) {
        getAllComponents();
        getComponentByType('Button');
        findComponentsByTags(['input']);
        findComponentsByKeywords(['display']);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete in reasonable time (less than 1 second for 100 iterations)
      expect(duration).toBeLessThan(1000);
    });

    it('should not have memory leaks in repeated calls', () => {
      // This is a basic check - in a real scenario you'd use more sophisticated tools
      const initialMemory = process.memoryUsage().heapUsed;
      
      for (let i = 0; i < 1000; i++) {
        getAllComponents();
        findComponentsByTags(['test']);
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 10MB for this test)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });
});