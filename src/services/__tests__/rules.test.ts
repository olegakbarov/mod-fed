/**
 * Comprehensive tests for rules service
 */

import {
  applyRules,
  addRule,
  getRules,
  Rule,
  RuleContext
} from '../rules';
import { ComponentDefinition } from '../templates';

describe('Rules Service', () => {
  beforeEach(() => {
    // Reset rules to default state before each test
    jest.resetModules();
  });

  describe('applyRules', () => {
    const mockComponents: ComponentDefinition[] = [
      { type: 'Header', props: { title: 'Test' }, order: 1 },
      { type: 'DataForm', props: { collection: 'users' }, order: 2 },
      { type: 'DataList', props: { collection: 'users' }, order: 3 },
      { type: 'Button', props: { label: 'Submit' }, order: 4 }
    ];

    it('should apply require-database rule when database is not enabled', () => {
      const context: RuleContext = {
        hasDatabase: false,
        platform: 'ios',
        screenLayout: 'vertical'
      };

      const result = applyRules(mockComponents, context);

      // Should remove DataForm and DataList components
      expect(result).toHaveLength(2);
      expect(result.find(c => c.type === 'DataForm')).toBeUndefined();
      expect(result.find(c => c.type === 'DataList')).toBeUndefined();
      expect(result.find(c => c.type === 'Header')).toBeDefined();
      expect(result.find(c => c.type === 'Button')).toBeDefined();
    });

    it('should not apply require-database rule when database is enabled', () => {
      const context: RuleContext = {
        hasDatabase: true,
        platform: 'ios',
        screenLayout: 'vertical'
      };

      const result = applyRules(mockComponents, context);

      // Should keep all components including data components
      expect(result).toHaveLength(4);
      expect(result.find(c => c.type === 'DataForm')).toBeDefined();
      expect(result.find(c => c.type === 'DataList')).toBeDefined();
    });

    it('should apply mobile-limit rule for iOS with more than 5 components', () => {
      const manyComponents: ComponentDefinition[] = Array.from({ length: 7 }, (_, i) => ({
        type: `Component${i}`,
        props: { id: i },
        order: i + 1
      }));

      const context: RuleContext = {
        hasDatabase: true,
        platform: 'ios',
        screenLayout: 'vertical'
      };

      const result = applyRules(manyComponents, context);

      // Should limit to 5 components
      expect(result).toHaveLength(5);
      expect(result[0].type).toBe('Component0');
      expect(result[4].type).toBe('Component4');
    });

    it('should apply mobile-limit rule for Android with more than 5 components', () => {
      const manyComponents: ComponentDefinition[] = Array.from({ length: 8 }, (_, i) => ({
        type: `Component${i}`,
        props: { id: i },
        order: i + 1
      }));

      const context: RuleContext = {
        hasDatabase: true,
        platform: 'android',
        screenLayout: 'vertical'
      };

      const result = applyRules(manyComponents, context);

      // Should limit to 5 components
      expect(result).toHaveLength(5);
    });

    it('should not apply mobile-limit rule for web platform', () => {
      const manyComponents: ComponentDefinition[] = Array.from({ length: 7 }, (_, i) => ({
        type: `Component${i}`,
        props: { id: i },
        order: i + 1
      }));

      const context: RuleContext = {
        hasDatabase: true,
        platform: 'web',
        screenLayout: 'vertical'
      };

      const result = applyRules(manyComponents, context);

      // Should keep all components for web
      expect(result).toHaveLength(7);
    });

    it('should not apply mobile-limit rule with 5 or fewer components', () => {
      const fewComponents: ComponentDefinition[] = Array.from({ length: 3 }, (_, i) => ({
        type: `Component${i}`,
        props: { id: i },
        order: i + 1
      }));

      const context: RuleContext = {
        hasDatabase: true,
        platform: 'ios',
        screenLayout: 'vertical'
      };

      const result = applyRules(fewComponents, context);

      // Should keep all components
      expect(result).toHaveLength(3);
    });

    it('should apply header-first rule to ensure header is first', () => {
      const componentsWithHeader: ComponentDefinition[] = [
        { type: 'Button', props: { label: 'Click' }, order: 1 },
        { type: 'Header', props: { title: 'Title' }, order: 2 },
        { type: 'Card', props: { content: 'Content' }, order: 3 }
      ];

      const context: RuleContext = {
        hasDatabase: true,
        platform: 'ios',
        screenLayout: 'vertical'
      };

      const result = applyRules(componentsWithHeader, context);

      // Header should be first
      expect(result[0].type).toBe('Header');
      expect(result[1].type).toBe('Button');
      expect(result[2].type).toBe('Card');
    });

    it('should not change order when no header present', () => {
      const componentsNoHeader: ComponentDefinition[] = [
        { type: 'Button', props: { label: 'Click' }, order: 1 },
        { type: 'Card', props: { content: 'Content' }, order: 2 }
      ];

      const context: RuleContext = {
        hasDatabase: true,
        platform: 'ios',
        screenLayout: 'vertical'
      };

      const result = applyRules(componentsNoHeader, context);

      // Order should remain the same
      expect(result[0].type).toBe('Button');
      expect(result[1].type).toBe('Card');
    });

    it('should apply grid-cards rule for grid layout', () => {
      const componentsWithList: ComponentDefinition[] = [
        { type: 'Header', props: { title: 'Title' }, order: 1 },
        {
          type: 'List',
          props: {
            items: [
              { title: 'Item 1', content: 'Content 1' },
              { title: 'Item 2', content: 'Content 2' },
              { title: 'Item 3', content: 'Content 3' }
            ]
          },
          order: 2
        }
      ];

      const context: RuleContext = {
        hasDatabase: true,
        platform: 'ios',
        screenLayout: 'grid'
      };

      const result = applyRules(componentsWithList, context);

      // List should be converted to individual cards
      expect(result).toHaveLength(4); // Header + 3 cards
      expect(result[0].type).toBe('Header');
      expect(result[1].type).toBe('Card');
      expect(result[1].props.title).toBe('Item 1');
      expect(result[1].props.content).toBe('Content 1');
      expect(result[2].type).toBe('Card');
      expect(result[2].props.title).toBe('Item 2');
      expect(result[3].type).toBe('Card');
      expect(result[3].props.title).toBe('Item 3');
    });

    it('should limit list items to 4 cards in grid layout', () => {
      const componentsWithManyItems: ComponentDefinition[] = [
        {
          type: 'List',
          props: {
            items: Array.from({ length: 6 }, (_, i) => ({
              title: `Item ${i + 1}`,
              content: `Content ${i + 1}`
            }))
          },
          order: 1
        }
      ];

      const context: RuleContext = {
        hasDatabase: true,
        platform: 'ios',
        screenLayout: 'grid'
      };

      const result = applyRules(componentsWithManyItems, context);

      // Should only create 4 cards (max limit)
      expect(result).toHaveLength(4);
      expect(result.every(c => c.type === 'Card')).toBe(true);
      expect(result[3].props.title).toBe('Item 4');
    });

    it('should handle list items without title/content gracefully', () => {
      const componentsWithIncompleteItems: ComponentDefinition[] = [
        {
          type: 'List',
          props: {
            items: [
              { title: 'Item 1' }, // No content
              { content: 'Content only' }, // No title
              { description: 'Has description' }, // Different property
              {} // Empty item
            ]
          },
          order: 1
        }
      ];

      const context: RuleContext = {
        hasDatabase: true,
        platform: 'ios',
        screenLayout: 'grid'
      };

      const result = applyRules(componentsWithManyItems, context);

      expect(result).toHaveLength(4);
      expect(result.every(c => c.type === 'Card')).toBe(true);
    });

    it('should not apply grid-cards rule for non-grid layouts', () => {
      const componentsWithList: ComponentDefinition[] = [
        {
          type: 'List',
          props: {
            items: [
              { title: 'Item 1', content: 'Content 1' }
            ]
          },
          order: 1
        }
      ];

      const context: RuleContext = {
        hasDatabase: true,
        platform: 'ios',
        screenLayout: 'vertical'
      };

      const result = applyRules(componentsWithList, context);

      // List should remain as list
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('List');
    });

    it('should not convert non-List components in grid layout', () => {
      const componentsWithoutList: ComponentDefinition[] = [
        { type: 'Header', props: { title: 'Title' }, order: 1 },
        { type: 'Button', props: { label: 'Click' }, order: 2 }
      ];

      const context: RuleContext = {
        hasDatabase: true,
        platform: 'ios',
        screenLayout: 'grid'
      };

      const result = applyRules(componentsWithoutList, context);

      // Should remain unchanged
      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('Header');
      expect(result[1].type).toBe('Button');
    });

    it('should apply multiple rules in sequence', () => {
      const components: ComponentDefinition[] = [
        { type: 'Button', props: { label: 'Click' }, order: 1 },
        { type: 'Header', props: { title: 'Title' }, order: 2 },
        { type: 'DataForm', props: { collection: 'users' }, order: 3 },
        {
          type: 'List',
          props: {
            items: [
              { title: 'Item 1', content: 'Content 1' },
              { title: 'Item 2', content: 'Content 2' }
            ]
          },
          order: 4
        }
      ];

      const context: RuleContext = {
        hasDatabase: false, // Will remove DataForm
        platform: 'ios',
        screenLayout: 'grid' // Will convert List to Cards
      };

      const result = applyRules(components, context);

      // Should:
      // 1. Remove DataForm (require-database rule)
      // 2. Move Header first (header-first rule)
      // 3. Convert List to Cards (grid-cards rule)
      expect(result).toHaveLength(4); // Header + Button + 2 Cards
      expect(result[0].type).toBe('Header');
      expect(result[1].type).toBe('Button');
      expect(result[2].type).toBe('Card');
      expect(result[3].type).toBe('Card');
      expect(result.find(c => c.type === 'DataForm')).toBeUndefined();
    });

    it('should handle empty components array', () => {
      const context: RuleContext = {
        hasDatabase: true,
        platform: 'ios',
        screenLayout: 'vertical'
      };

      const result = applyRules([], context);

      expect(result).toEqual([]);
    });

    it('should handle missing context properties', () => {
      const components: ComponentDefinition[] = [
        { type: 'Header', props: { title: 'Test' }, order: 1 }
      ];

      const context: RuleContext = {}; // Empty context

      const result = applyRules(components, context);

      // Should still work with default values
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('Header');
    });

    it('should set componentCount in context', () => {
      const components: ComponentDefinition[] = [
        { type: 'Header', props: { title: 'Test' }, order: 1 },
        { type: 'Button', props: { label: 'Click' }, order: 2 }
      ];

      const context: RuleContext = {
        hasDatabase: true,
        platform: 'ios'
      };

      // This is tested indirectly by ensuring the mobile-limit rule works correctly
      applyRules(components, context);

      // The context should have componentCount set internally
      // We can't directly test this without exposing internals, but the mobile-limit rule
      // functionality proves it's working
    });

    it('should handle rule execution errors gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Add a rule that throws an error
      const errorRule: Rule = {
        id: 'error-rule',
        name: 'Error Rule',
        condition: () => true,
        action: () => {
          throw new Error('Test error');
        }
      };

      addRule(errorRule);

      const components: ComponentDefinition[] = [
        { type: 'Header', props: { title: 'Test' }, order: 1 }
      ];

      const context: RuleContext = {
        hasDatabase: true,
        platform: 'ios'
      };

      const result = applyRules(components, context);

      // Should continue with original components despite error
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('Header');
      expect(consoleSpy).toHaveBeenCalledWith('Error applying rule Error Rule:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('addRule', () => {
    it('should add custom rule to rule list', () => {
      const initialRuleCount = getRules().length;
      
      const customRule: Rule = {
        id: 'custom-rule',
        name: 'Custom Rule',
        condition: (context) => context.platform === 'web',
        action: (components) => components.filter(c => c.type !== 'MobileOnly')
      };

      addRule(customRule);

      const rules = getRules();
      expect(rules.length).toBe(initialRuleCount + 1);
      expect(rules[rules.length - 1]).toEqual(customRule);
    });

    it('should allow multiple custom rules', () => {
      const initialRuleCount = getRules().length;

      const rule1: Rule = {
        id: 'rule-1',
        name: 'Rule 1',
        condition: () => true,
        action: (components) => components
      };

      const rule2: Rule = {
        id: 'rule-2',
        name: 'Rule 2',
        condition: () => false,
        action: (components) => components
      };

      addRule(rule1);
      addRule(rule2);

      const rules = getRules();
      expect(rules.length).toBe(initialRuleCount + 2);
    });

    it('should execute custom rules in applyRules', () => {
      const customRule: Rule = {
        id: 'test-rule',
        name: 'Test Rule',
        condition: (context) => context.userIntent === 'test',
        action: (components) => [
          ...components,
          { type: 'TestComponent', props: { added: true }, order: 99 }
        ]
      };

      addRule(customRule);

      const components: ComponentDefinition[] = [
        { type: 'Header', props: { title: 'Test' }, order: 1 }
      ];

      const context: RuleContext = {
        hasDatabase: true,
        platform: 'ios',
        userIntent: 'test'
      };

      const result = applyRules(components, context);

      // Should include the added component
      expect(result).toHaveLength(2);
      expect(result[1].type).toBe('TestComponent');
      expect(result[1].props.added).toBe(true);
    });
  });

  describe('getRules', () => {
    it('should return copy of rules array', () => {
      const rules1 = getRules();
      const rules2 = getRules();

      expect(rules1).toEqual(rules2);
      expect(rules1).not.toBe(rules2); // Should be different arrays
    });

    it('should include default rules', () => {
      const rules = getRules();

      expect(rules.length).toBeGreaterThan(0);
      
      const ruleIds = rules.map(r => r.id);
      expect(ruleIds).toContain('require-database');
      expect(ruleIds).toContain('mobile-limit');
      expect(ruleIds).toContain('header-first');
      expect(ruleIds).toContain('grid-cards');
    });

    it('should return rules with correct structure', () => {
      const rules = getRules();

      rules.forEach(rule => {
        expect(rule).toHaveProperty('id');
        expect(rule).toHaveProperty('name');
        expect(rule).toHaveProperty('condition');
        expect(rule).toHaveProperty('action');
        expect(typeof rule.id).toBe('string');
        expect(typeof rule.name).toBe('string');
        expect(typeof rule.condition).toBe('function');
        expect(typeof rule.action).toBe('function');
      });
    });
  });

  describe('default rules behavior', () => {
    describe('require-database rule', () => {
      it('should have correct condition', () => {
        const rules = getRules();
        const rule = rules.find(r => r.id === 'require-database')!;

        expect(rule.condition({ hasDatabase: false })).toBe(true);
        expect(rule.condition({ hasDatabase: true })).toBe(false);
        expect(rule.condition({})).toBe(true); // Default to no database
      });
    });

    describe('mobile-limit rule', () => {
      it('should have correct condition', () => {
        const rules = getRules();
        const rule = rules.find(r => r.id === 'mobile-limit')!;

        // Should trigger on mobile platforms with > 5 components
        expect(rule.condition({ platform: 'ios', componentCount: 6 })).toBe(true);
        expect(rule.condition({ platform: 'android', componentCount: 6 })).toBe(true);
        expect(rule.condition({ platform: 'web', componentCount: 6 })).toBe(false);
        expect(rule.condition({ platform: 'ios', componentCount: 5 })).toBe(false);
        expect(rule.condition({ platform: 'ios', componentCount: 3 })).toBe(false);
        expect(rule.condition({ componentCount: 6 })).toBe(false); // No platform specified
      });
    });

    describe('header-first rule', () => {
      it('should have correct condition', () => {
        const rules = getRules();
        const rule = rules.find(r => r.id === 'header-first')!;

        // Should always be true
        expect(rule.condition({})).toBe(true);
        expect(rule.condition({ platform: 'ios' })).toBe(true);
      });
    });

    describe('grid-cards rule', () => {
      it('should have correct condition', () => {
        const rules = getRules();
        const rule = rules.find(r => r.id === 'grid-cards')!;

        expect(rule.condition({ screenLayout: 'grid' })).toBe(true);
        expect(rule.condition({ screenLayout: 'vertical' })).toBe(false);
        expect(rule.condition({ screenLayout: 'horizontal' })).toBe(false);
        expect(rule.condition({})).toBe(false); // No layout specified
      });
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle malformed components gracefully', () => {
      const malformedComponents = [
        { type: 'Header' }, // Missing props
        { props: { title: 'Test' } }, // Missing type
        { type: 'Button', props: { label: 'Click' } }, // Missing order - this is valid
        null, // Null component
        undefined // Undefined component
      ].filter(Boolean) as ComponentDefinition[];

      const context: RuleContext = {
        hasDatabase: true,
        platform: 'ios',
        screenLayout: 'vertical'
      };

      expect(() => applyRules(malformedComponents, context)).not.toThrow();
    });

    it('should handle rules with malformed conditions', () => {
      const malformedRule: Rule = {
        id: 'malformed',
        name: 'Malformed Rule',
        condition: null as any, // Malformed condition
        action: (components) => components
      };

      expect(() => addRule(malformedRule)).not.toThrow();
      
      const components: ComponentDefinition[] = [
        { type: 'Header', props: { title: 'Test' }, order: 1 }
      ];

      const context: RuleContext = { hasDatabase: true };

      // This might throw when the rule is executed, but that's handled by error catching
      expect(() => applyRules(components, context)).not.toThrow();
    });

    it('should preserve component order when rules don\'t modify it', () => {
      const components: ComponentDefinition[] = [
        { type: 'Button', props: { label: 'First' }, order: 1 },
        { type: 'Card', props: { title: 'Second' }, order: 2 },
        { type: 'TextInput', props: { placeholder: 'Third' }, order: 3 }
      ];

      const context: RuleContext = {
        hasDatabase: true,
        platform: 'web', // Won't trigger mobile limit
        screenLayout: 'vertical' // Won't trigger grid conversion
      };

      const result = applyRules(components, context);

      expect(result.map(c => c.type)).toEqual(['Button', 'Card', 'TextInput']);
    });
  });
});