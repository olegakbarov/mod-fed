/**
 * Comprehensive tests for templates service
 */

import {
  getTemplate,
  getAllTemplates,
  findTemplatesByKeywords,
  findBestTemplate,
  interpolateTemplate,
  AppTemplate,
  ComponentDefinition,
  ScreenDefinition,
  TemplateVariable
} from '../templates';
import * as templateIndex from '../../templates';

// Mock the templates index
jest.mock('../../templates');
const mockTemplateIndex = templateIndex as jest.Mocked<typeof templateIndex>;

describe('Templates Service', () => {
  const mockTemplates: AppTemplate[] = [
    {
      id: 'todo-app',
      name: 'Todo App',
      description: 'A simple todo application for task management',
      keywords: ['todo', 'task', 'list', 'productivity'],
      aiTags: ['productivity', 'organization', 'tasks'],
      variables: {
        appTitle: 'Todo App',
        welcomeMessage: 'Welcome to your Todo App',
        maxTasks: 100
      },
      screens: [{
        name: 'MainScreen',
        title: 'Todo List',
        layout: 'vertical',
        components: [
          { type: 'Header', props: { title: '{{appTitle}}' }, order: 1 },
          { type: 'List', props: { items: '{{todoItems}}' }, order: 2 },
          { type: 'Button', props: { label: 'Add Task' }, order: 3 }
        ]
      }],
      metadata: {
        version: '1.0.0',
        author: 'System',
        category: 'Productivity'
      }
    },
    {
      id: 'dashboard-app',
      name: 'Dashboard App',
      description: 'Analytics dashboard with charts and metrics',
      keywords: ['dashboard', 'analytics', 'charts', 'metrics'],
      aiTags: ['analytics', 'business', 'data'],
      variables: {
        appTitle: 'Analytics Dashboard',
        refreshInterval: 60000
      },
      screens: [{
        name: 'DashboardScreen',
        title: 'Dashboard',
        layout: 'grid',
        components: [
          { type: 'Header', props: { title: '{{appTitle}}' }, order: 1 },
          { type: 'Card', props: { title: 'Metrics' }, order: 2 }
        ]
      }],
      metadata: {
        version: '1.0.0',
        author: 'System',
        category: 'Business'
      }
    },
    {
      id: 'blog-app',
      name: 'Blog App',
      description: 'Simple blog application for articles and posts',
      keywords: ['blog', 'article', 'content', 'writing'],
      aiTags: ['content', 'publishing', 'writing'],
      variables: {
        appTitle: 'My Blog',
        postsPerPage: 10
      },
      screens: [{
        name: 'BlogScreen',
        title: 'Blog Posts',
        layout: 'vertical',
        components: [
          { type: 'Header', props: { title: '{{appTitle}}' }, order: 1 },
          { type: 'List', props: { items: '{{blogPosts}}' }, order: 2 }
        ]
      }],
      metadata: {
        version: '1.0.0',
        author: 'System',
        category: 'Content'
      }
    }
  ];

  beforeEach(() => {
    mockTemplateIndex.allTemplates = mockTemplates;
    jest.clearAllMocks();
  });

  describe('getTemplate', () => {
    it('should return template by id', () => {
      const result = getTemplate('todo-app');
      expect(result).toEqual(mockTemplates[0]);
    });

    it('should return undefined for non-existent template', () => {
      const result = getTemplate('non-existent-app');
      expect(result).toBeUndefined();
    });

    it('should return undefined for empty or null id', () => {
      expect(getTemplate('')).toBeUndefined();
      expect(getTemplate(null as any)).toBeUndefined();
      expect(getTemplate(undefined as any)).toBeUndefined();
    });
  });

  describe('getAllTemplates', () => {
    it('should return all templates', () => {
      const result = getAllTemplates();
      expect(result).toEqual(mockTemplates);
      expect(result).toHaveLength(3);
    });

    it('should return a copy of templates array', () => {
      const result = getAllTemplates();
      result.push({} as any);
      expect(getAllTemplates()).toHaveLength(3); // Original should not be modified
    });

    it('should handle empty templates array', () => {
      mockTemplateIndex.allTemplates = [];
      const result = getAllTemplates();
      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('findTemplatesByKeywords', () => {
    it('should find templates by exact keyword match', () => {
      const result = findTemplatesByKeywords(['todo']);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('todo-app');
    });

    it('should find templates by multiple keywords', () => {
      const result = findTemplatesByKeywords(['todo', 'dashboard']);
      expect(result).toHaveLength(2);
      expect(result.map(t => t.id)).toContain('todo-app');
      expect(result.map(t => t.id)).toContain('dashboard-app');
    });

    it('should match keywords in AI tags', () => {
      const result = findTemplatesByKeywords(['productivity']);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('todo-app');
    });

    it('should match keywords in template name', () => {
      const result = findTemplatesByKeywords(['Blog']);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('blog-app');
    });

    it('should match keywords in description', () => {
      const result = findTemplatesByKeywords(['analytics']);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('dashboard-app');
    });

    it('should be case insensitive', () => {
      const result = findTemplatesByKeywords(['TODO', 'Dashboard', 'BLOG']);
      expect(result).toHaveLength(3);
    });

    it('should return empty array for no matches', () => {
      const result = findTemplatesByKeywords(['nonexistent']);
      expect(result).toEqual([]);
    });

    it('should handle empty keywords array', () => {
      const result = findTemplatesByKeywords([]);
      expect(result).toEqual([]);
    });

    it('should handle whitespace in keywords', () => {
      const result = findTemplatesByKeywords(['  todo  ', ' dashboard ']);
      expect(result).toHaveLength(2);
    });

    it('should not match partial keywords in middle of words', () => {
      const result = findTemplatesByKeywords(['od']); // Should not match 'todo'
      expect(result).toEqual([]);
    });
  });

  describe('findBestTemplate', () => {
    it('should return template with highest score', () => {
      const result = findBestTemplate(['todo', 'task', 'productivity']);
      expect(result).toBeTruthy();
      expect(result!.id).toBe('todo-app');
    });

    it('should return null for no matches', () => {
      const result = findBestTemplate(['nonexistent']);
      expect(result).toBeNull();
    });

    it('should prefer exact keyword matches over partial matches', () => {
      const result = findBestTemplate(['dashboard']);
      expect(result!.id).toBe('dashboard-app');
    });

    it('should score templates correctly', () => {
      // Todo template should score higher for productivity keywords
      const result1 = findBestTemplate(['productivity', 'task']);
      expect(result1!.id).toBe('todo-app');

      // Dashboard template should score higher for business keywords
      const result2 = findBestTemplate(['business', 'analytics']);
      expect(result2!.id).toBe('dashboard-app');
    });

    it('should handle empty keywords array', () => {
      const result = findBestTemplate([]);
      expect(result).toBeNull();
    });

    it('should return first match when scores are equal', () => {
      // Modify templates to have same keywords for testing
      const modifiedTemplates = mockTemplates.map(t => ({
        ...t,
        keywords: ['common'],
        aiTags: ['common']
      }));
      mockTemplateIndex.allTemplates = modifiedTemplates;

      const result = findBestTemplate(['common']);
      expect(result!.id).toBe('todo-app'); // First template
    });
  });

  describe('calculateMatchScore (internal)', () => {
    // This tests the internal scoring logic indirectly through findBestTemplate
    it('should score keyword matches higher than tag matches', () => {
      // Create specific test scenario
      const testTemplates: AppTemplate[] = [
        {
          id: 'keyword-match',
          name: 'Test',
          description: '',
          keywords: ['test'],
          aiTags: ['other'],
          variables: {},
          screens: [],
          metadata: { version: '1.0.0', author: 'System', category: 'Test' }
        },
        {
          id: 'tag-match',
          name: 'Test',
          description: '',
          keywords: ['other'],
          aiTags: ['test'],
          variables: {},
          screens: [],
          metadata: { version: '1.0.0', author: 'System', category: 'Test' }
        }
      ];
      mockTemplateIndex.allTemplates = testTemplates;

      const result = findBestTemplate(['test']);
      expect(result!.id).toBe('keyword-match'); // Should prefer keyword match
    });

    it('should accumulate scores for multiple matches', () => {
      const testTemplates: AppTemplate[] = [
        {
          id: 'single-match',
          name: 'Test',
          description: '',
          keywords: ['test'],
          aiTags: [],
          variables: {},
          screens: [],
          metadata: { version: '1.0.0', author: 'System', category: 'Test' }
        },
        {
          id: 'multiple-match',
          name: 'Test App',
          description: 'test description',
          keywords: ['test'],
          aiTags: ['test'],
          variables: {},
          screens: [],
          metadata: { version: '1.0.0', author: 'System', category: 'Test' }
        }
      ];
      mockTemplateIndex.allTemplates = testTemplates;

      const result = findBestTemplate(['test']);
      expect(result!.id).toBe('multiple-match'); // Should prefer multiple matches
    });
  });

  describe('interpolateTemplate', () => {
    const baseTemplate: AppTemplate = {
      id: 'test-template',
      name: 'Test Template',
      description: 'Template with {{variable}} placeholders',
      keywords: ['test'],
      aiTags: ['test'],
      variables: {
        appTitle: 'Default Title',
        maxItems: 10
      },
      screens: [{
        name: 'TestScreen',
        title: '{{screenTitle}}',
        layout: 'vertical',
        components: [
          { type: 'Header', props: { title: '{{appTitle}}' }, order: 1 },
          { type: 'Card', props: { content: 'Welcome to {{appTitle}}!' }, order: 2 }
        ]
      }],
      metadata: {
        version: '1.0.0',
        author: '{{author}}',
        category: 'Test'
      }
    };

    it('should interpolate variables correctly', () => {
      const variables: TemplateVariable = {
        appTitle: 'My Custom App',
        screenTitle: 'Main Screen',
        author: 'John Doe'
      };

      const result = interpolateTemplate(baseTemplate, variables);

      expect(result.description).toBe('Template with {{variable}} placeholders');
      expect(result.screens[0].title).toBe('Main Screen');
      expect(result.screens[0].components[0].props.title).toBe('My Custom App');
      expect(result.screens[0].components[1].props.content).toBe('Welcome to My Custom App!');
      expect(result.metadata.author).toBe('John Doe');
    });

    it('should preserve original template when no variables provided', () => {
      const result = interpolateTemplate(baseTemplate);
      expect(result).toEqual(baseTemplate);
    });

    it('should handle empty variables object', () => {
      const result = interpolateTemplate(baseTemplate, {});
      expect(result).toEqual(baseTemplate);
    });

    it('should merge template variables with provided variables', () => {
      const variables: TemplateVariable = {
        appTitle: 'Custom Title',
        newVariable: 'New Value'
      };

      const result = interpolateTemplate(baseTemplate, variables);

      expect(result.screens[0].components[0].props.title).toBe('Custom Title');
      // Should preserve original variables
      expect(result.variables.maxItems).toBe(10);
      // Should add new variables
      expect(result.variables.newVariable).toBe('New Value');
    });

    it('should not modify original template', () => {
      const originalDescription = baseTemplate.description;
      const variables: TemplateVariable = { appTitle: 'Modified Title' };

      interpolateTemplate(baseTemplate, variables);

      expect(baseTemplate.description).toBe(originalDescription);
      expect(baseTemplate.screens[0].components[0].props.title).toBe('{{appTitle}}');
    });

    it('should handle nested object interpolation', () => {
      const templateWithNested: AppTemplate = {
        ...baseTemplate,
        screens: [{
          ...baseTemplate.screens[0],
          components: [{
            type: 'Complex',
            props: {
              config: {
                title: '{{appTitle}}',
                nested: {
                  value: 'Nested {{value}}'
                }
              }
            },
            order: 1
          }]
        }]
      };

      const variables: TemplateVariable = {
        appTitle: 'Nested App',
        value: 'Success'
      };

      const result = interpolateTemplate(templateWithNested, variables);

      expect(result.screens[0].components[0].props.config.title).toBe('Nested App');
      expect(result.screens[0].components[0].props.config.nested.value).toBe('Nested Success');
    });

    it('should handle array interpolation', () => {
      const templateWithArray: AppTemplate = {
        ...baseTemplate,
        screens: [{
          ...baseTemplate.screens[0],
          components: [{
            type: 'List',
            props: {
              items: ['{{item1}}', 'static item', '{{item2}}']
            },
            order: 1
          }]
        }]
      };

      const variables: TemplateVariable = {
        item1: 'First Item',
        item2: 'Second Item'
      };

      const result = interpolateTemplate(templateWithArray, variables);

      expect(result.screens[0].components[0].props.items).toEqual([
        'First Item',
        'static item',
        'Second Item'
      ]);
    });

    it('should leave unmatched placeholders as-is', () => {
      const variables: TemplateVariable = {
        appTitle: 'Known Value'
      };

      const result = interpolateTemplate(baseTemplate, variables);

      expect(result.screens[0].components[0].props.title).toBe('Known Value');
      expect(result.screens[0].title).toBe('{{screenTitle}}'); // Should remain unmatched
      expect(result.metadata.author).toBe('{{author}}'); // Should remain unmatched
    });

    it('should handle different variable types', () => {
      const templateWithTypes: AppTemplate = {
        ...baseTemplate,
        screens: [{
          ...baseTemplate.screens[0],
          components: [{
            type: 'Test',
            props: {
              stringValue: '{{stringVar}}',
              numberValue: '{{numberVar}}',
              booleanValue: '{{booleanVar}}',
              nullValue: '{{nullVar}}'
            },
            order: 1
          }]
        }]
      };

      const variables: TemplateVariable = {
        stringVar: 'Hello',
        numberVar: 42,
        booleanVar: true,
        nullVar: null
      };

      const result = interpolateTemplate(templateWithTypes, variables);

      expect(result.screens[0].components[0].props.stringValue).toBe('Hello');
      expect(result.screens[0].components[0].props.numberValue).toBe('42');
      expect(result.screens[0].components[0].props.booleanValue).toBe('true');
      expect(result.screens[0].components[0].props.nullValue).toBe('{{nullVar}}'); // null becomes unmatched
    });

    it('should handle whitespace in variable names', () => {
      const templateWithSpaces: AppTemplate = {
        ...baseTemplate,
        screens: [{
          ...baseTemplate.screens[0],
          components: [{
            type: 'Test',
            props: {
              value1: '{{ appTitle }}',
              value2: '{{  spaced  }}',
              value3: '{{normal}}'
            },
            order: 1
          }]
        }]
      };

      const variables: TemplateVariable = {
        appTitle: 'Spaced App',
        spaced: 'Spaced Value',
        normal: 'Normal Value'
      };

      const result = interpolateTemplate(templateWithSpaces, variables);

      expect(result.screens[0].components[0].props.value1).toBe('Spaced App');
      expect(result.screens[0].components[0].props.value2).toBe('Spaced Value');
      expect(result.screens[0].components[0].props.value3).toBe('Normal Value');
    });

    it('should handle malformed placeholders gracefully', () => {
      const templateWithMalformed: AppTemplate = {
        ...baseTemplate,
        screens: [{
          ...baseTemplate.screens[0],
          components: [{
            type: 'Test',
            props: {
              valid: '{{validVar}}',
              incomplete1: '{{incomplete',
              incomplete2: 'incomplete}}',
              empty: '{{}}',
              nested: '{{outer {{inner}} end}}'
            },
            order: 1
          }]
        }]
      };

      const variables: TemplateVariable = {
        validVar: 'Valid'
      };

      const result = interpolateTemplate(templateWithMalformed, variables);

      expect(result.screens[0].components[0].props.valid).toBe('Valid');
      expect(result.screens[0].components[0].props.incomplete1).toBe('{{incomplete');
      expect(result.screens[0].components[0].props.incomplete2).toBe('incomplete}}');
      expect(result.screens[0].components[0].props.empty).toBe('{{}}');
      // This should handle nested braces gracefully
      expect(result.screens[0].components[0].props.nested).toContain('{{outer');
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle null/undefined templates gracefully', () => {
      expect(getTemplate(null as any)).toBeUndefined();
      expect(getTemplate(undefined as any)).toBeUndefined();
      
      expect(findTemplatesByKeywords(null as any)).toEqual([]);
      expect(findTemplatesByKeywords(undefined as any)).toEqual([]);
      
      expect(findBestTemplate(null as any)).toBeNull();
      expect(findBestTemplate(undefined as any)).toBeNull();
    });

    it('should handle templates with missing properties', () => {
      const incompleteTemplate: Partial<AppTemplate> = {
        id: 'incomplete',
        name: 'Incomplete',
        // Missing required properties
      };

      mockTemplateIndex.allTemplates = [incompleteTemplate as AppTemplate];

      expect(() => getAllTemplates()).not.toThrow();
      expect(() => findTemplatesByKeywords(['test'])).not.toThrow();
    });

    it('should handle very large templates', () => {
      const largeTemplate: AppTemplate = {
        id: 'large-template',
        name: 'Large Template',
        description: 'A'.repeat(1000), // Very long description
        keywords: Array.from({ length: 100 }, (_, i) => `keyword${i}`), // Many keywords
        aiTags: Array.from({ length: 100 }, (_, i) => `tag${i}`),
        variables: Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`var${i}`, `value${i}`])),
        screens: Array.from({ length: 50 }, (_, i) => ({ // Many screens
          name: `Screen${i}`,
          title: `Screen ${i}`,
          layout: 'vertical' as const,
          components: Array.from({ length: 20 }, (_, j) => ({ // Many components per screen
            type: `Component${j}`,
            props: { id: `${i}-${j}` },
            order: j
          }))
        })),
        metadata: {
          version: '1.0.0',
          author: 'System',
          category: 'Test'
        }
      };

      mockTemplateIndex.allTemplates = [largeTemplate];

      expect(() => getAllTemplates()).not.toThrow();
      expect(() => findTemplatesByKeywords(['keyword50'])).not.toThrow();
      expect(() => interpolateTemplate(largeTemplate, { var50: 'interpolated' })).not.toThrow();
    });
  });
});