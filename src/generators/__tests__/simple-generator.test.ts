/**
 * Comprehensive tests for SimpleAIGenerator
 */

import { SimpleAIGenerator, AppSpec, ScreenSpec, ComponentSpec } from '../simple-generator';
import * as templatesService from '../../services/templates';
import * as rulesService from '../../services/rules';
import { AppTemplate, ComponentDefinition } from '../../services/templates';

// Mock the services
jest.mock('../../services/templates');
jest.mock('../../services/rules');

const mockTemplatesService = templatesService as jest.Mocked<typeof templatesService>;
const mockRulesService = rulesService as jest.Mocked<typeof rulesService>;

describe('SimpleAIGenerator', () => {
  let generator: SimpleAIGenerator;

  beforeEach(() => {
    generator = new SimpleAIGenerator();
    jest.clearAllMocks();
  });

  describe('generateApp', () => {
    it('should generate a complete app spec from a todo prompt', async () => {
      const mockTemplate: AppTemplate = {
        id: 'todo-app',
        name: 'Todo App',
        description: 'A todo application',
        keywords: ['todo', 'task'],
        aiTags: ['productivity'],
        variables: {
          appTitle: 'Todo App',
          welcomeMessage: 'Welcome to Todo App'
        },
        screens: [{
          name: 'MainScreen',
          title: 'Main',
          layout: 'vertical',
          components: [
            { type: 'Header', props: { title: '{{appTitle}}' }, order: 1 },
            { type: 'List', props: { items: [] }, order: 2 }
          ]
        }],
        metadata: {
          version: '1.0.0',
          author: 'System',
          category: 'Productivity'
        }
      };

      const interpolatedTemplate: AppTemplate = {
        ...mockTemplate,
        variables: { appTitle: 'Todo App', welcomeMessage: 'Welcome to Todo App' },
        screens: [{
          ...mockTemplate.screens[0],
          components: [
            { type: 'Header', props: { title: 'Todo App' }, order: 1 },
            { type: 'List', props: { items: [] }, order: 2 }
          ]
        }]
      };

      mockTemplatesService.findBestTemplate.mockReturnValue(mockTemplate);
      mockTemplatesService.interpolateTemplate.mockReturnValue(interpolatedTemplate);
      mockRulesService.applyRules.mockReturnValue(interpolatedTemplate.screens[0].components);

      const result = await generator.generateApp('I want a todo app');

      expect(result).toEqual({
        appName: 'Todo App',
        screens: [{
          name: 'MainScreen',
          components: [
            { type: 'Header', props: { title: 'Todo App' } },
            { type: 'List', props: { items: [] } }
          ]
        }]
      });

      expect(mockTemplatesService.findBestTemplate).toHaveBeenCalledWith(['todo']);
      expect(mockTemplatesService.interpolateTemplate).toHaveBeenCalled();
      expect(mockRulesService.applyRules).toHaveBeenCalled();
    });

    it('should generate a fallback app when error occurs', async () => {
      mockTemplatesService.findBestTemplate.mockImplementation(() => {
        throw new Error('Template error');
      });

      const result = await generator.generateApp('test prompt');

      expect(result).toEqual({
        appName: 'Generated App',
        screens: [{
          name: 'MainScreen',
          components: [
            { type: 'Header', props: { title: 'test prompt' } },
            { type: 'Card', props: { title: 'Welcome', content: 'App generated from: "test prompt..."' } },
            { type: 'Button', props: { label: 'Get Started' } }
          ]
        }]
      });
    });

    it('should handle custom app names from prompt', async () => {
      const mockTemplate: AppTemplate = {
        id: 'generic-app',
        name: 'Generic App',
        description: 'Generic application',
        keywords: ['generic'],
        aiTags: ['general'],
        variables: { appTitle: 'Generic App' },
        screens: [{
          name: 'MainScreen',
          title: 'Main',
          layout: 'vertical',
          components: [{ type: 'Header', props: { title: '{{appTitle}}' }, order: 1 }]
        }],
        metadata: { version: '1.0.0', author: 'System', category: 'General' }
      };

      mockTemplatesService.findBestTemplate.mockReturnValue(null);
      mockTemplatesService.getTemplate.mockReturnValue(mockTemplate);
      mockTemplatesService.interpolateTemplate.mockReturnValue({
        ...mockTemplate,
        screens: [{
          ...mockTemplate.screens[0],
          components: [{ type: 'Header', props: { title: 'My Custom App' }, order: 1 }]
        }]
      });
      mockRulesService.applyRules.mockReturnValue([{ type: 'Header', props: { title: 'My Custom App' }, order: 1 }]);

      const result = await generator.generateApp('Create an app called "My Custom App"');

      expect(result.appName).toContain('Generic App');
      expect(mockTemplatesService.interpolateTemplate).toHaveBeenCalledWith(
        mockTemplate,
        expect.objectContaining({
          appTitle: 'My Custom App',
          appName: 'My Custom App'
        })
      );
    });

    it('should include database configuration when template enables it', async () => {
      const mockTemplate: AppTemplate = {
        id: 'data-app',
        name: 'Data App',
        description: 'Data application',
        keywords: ['data'],
        aiTags: ['data'],
        variables: { appTitle: 'Data App' },
        enableDatabase: true,
        dataCollection: 'users',
        screens: [{
          name: 'MainScreen',
          title: 'Main',
          layout: 'vertical',
          components: [{ type: 'DataForm', props: { collection: 'users' }, order: 1 }]
        }],
        metadata: { version: '1.0.0', author: 'System', category: 'Data' }
      };

      mockTemplatesService.findBestTemplate.mockReturnValue(mockTemplate);
      mockTemplatesService.interpolateTemplate.mockReturnValue(mockTemplate);
      mockRulesService.applyRules.mockReturnValue(mockTemplate.screens[0].components);

      const result = await generator.generateApp('data management app');

      expect(result.enableDatabase).toBe(true);
      expect(result.dataCollection).toBe('users');
    });
  });

  describe('extractKeywords', () => {
    it('should extract keywords from prompt', () => {
      const generator = new SimpleAIGenerator();
      // Access private method for testing
      const extractKeywords = (generator as any).extractKeywords.bind(generator);

      expect(extractKeywords('I want a todo list app')).toEqual(['todo', 'list']);
      expect(extractKeywords('Build me a dashboard with analytics')).toEqual(['dashboard', 'analytics']);
      expect(extractKeywords('Create a blog for articles')).toEqual(['blog', 'article']);
      expect(extractKeywords('Social chat application')).toEqual(['social', 'chat']);
      expect(extractKeywords('Shopping store inventory tracker')).toEqual(['inventory', 'shop', 'store', 'tracker']);
    });

    it('should handle case insensitive matching', () => {
      const extractKeywords = (generator as any).extractKeywords.bind(generator);
      
      expect(extractKeywords('TODO List App')).toEqual(['todo', 'list']);
      expect(extractKeywords('DASHBOARD Analytics')).toEqual(['dashboard', 'analytics']);
    });

    it('should return empty array for no matches', () => {
      const extractKeywords = (generator as any).extractKeywords.bind(generator);
      
      expect(extractKeywords('some random text')).toEqual([]);
      expect(extractKeywords('')).toEqual([]);
    });
  });

  describe('selectTemplate', () => {
    beforeEach(() => {
      mockTemplatesService.getTemplate.mockImplementation((id: string) => {
        const templates: Record<string, AppTemplate> = {
          'todo-app': { id: 'todo-app', name: 'Todo App', description: '', keywords: [], aiTags: [], variables: {}, screens: [], metadata: { version: '', author: '', category: '' } },
          'dashboard-app': { id: 'dashboard-app', name: 'Dashboard App', description: '', keywords: [], aiTags: [], variables: {}, screens: [], metadata: { version: '', author: '', category: '' } },
          'blog-app': { id: 'blog-app', name: 'Blog App', description: '', keywords: [], aiTags: [], variables: {}, screens: [], metadata: { version: '', author: '', category: '' } },
          'generic-app': { id: 'generic-app', name: 'Generic App', description: '', keywords: [], aiTags: [], variables: {}, screens: [], metadata: { version: '', author: '', category: '' } }
        };
        return templates[id] || null;
      });
    });

    it('should select template by keywords', () => {
      const selectTemplate = (generator as any).selectTemplate.bind(generator);
      const mockTemplate = { id: 'todo-app', name: 'Todo App' };
      
      mockTemplatesService.findBestTemplate.mockReturnValue(mockTemplate as AppTemplate);

      const result = selectTemplate(['todo'], 'todo app');
      expect(result).toEqual(mockTemplate);
      expect(mockTemplatesService.findBestTemplate).toHaveBeenCalledWith(['todo']);
    });

    it('should fallback to intent-based selection for todo', () => {
      const selectTemplate = (generator as any).selectTemplate.bind(generator);
      
      mockTemplatesService.findBestTemplate.mockReturnValue(null);

      const result = selectTemplate([], 'I need a todo application');
      expect(result.id).toBe('todo-app');
      expect(mockTemplatesService.getTemplate).toHaveBeenCalledWith('todo-app');
    });

    it('should fallback to intent-based selection for dashboard', () => {
      const selectTemplate = (generator as any).selectTemplate.bind(generator);
      
      mockTemplatesService.findBestTemplate.mockReturnValue(null);

      const result = selectTemplate([], 'I need analytics dashboard');
      expect(result.id).toBe('dashboard-app');
      expect(mockTemplatesService.getTemplate).toHaveBeenCalledWith('dashboard-app');
    });

    it('should fallback to intent-based selection for blog', () => {
      const selectTemplate = (generator as any).selectTemplate.bind(generator);
      
      mockTemplatesService.findBestTemplate.mockReturnValue(null);

      const result = selectTemplate([], 'I need a blog for articles');
      expect(result.id).toBe('blog-app');
      expect(mockTemplatesService.getTemplate).toHaveBeenCalledWith('blog-app');
    });

    it('should use generic template as final fallback', () => {
      const selectTemplate = (generator as any).selectTemplate.bind(generator);
      
      mockTemplatesService.findBestTemplate.mockReturnValue(null);
      mockTemplatesService.getTemplate
        .mockReturnValueOnce(null) // First call returns null
        .mockReturnValueOnce({ id: 'generic-app', name: 'Generic App' } as AppTemplate); // Second call returns generic

      const result = selectTemplate([], 'some random prompt');
      expect(result.id).toBe('generic-app');
    });

    it('should use hardcoded generic template if all else fails', () => {
      const selectTemplate = (generator as any).selectTemplate.bind(generator);
      
      mockTemplatesService.findBestTemplate.mockReturnValue(null);
      mockTemplatesService.getTemplate.mockReturnValue(null);

      const result = selectTemplate([], 'some random prompt');
      expect(result.id).toBe('default');
      expect(result.name).toBe('Default App');
      expect(result.screens).toHaveLength(1);
      expect(result.screens[0].components).toHaveLength(2);
    });
  });

  describe('customizeTemplate', () => {
    it('should extract custom app name from prompt', () => {
      const customizeTemplate = (generator as any).customizeTemplate.bind(generator);
      const mockTemplate: AppTemplate = {
        id: 'test',
        name: 'Test',
        description: '',
        keywords: [],
        aiTags: [],
        variables: { appTitle: 'Default Title' },
        screens: [],
        metadata: { version: '', author: '', category: '' }
      };

      mockTemplatesService.interpolateTemplate.mockReturnValue(mockTemplate);

      customizeTemplate(mockTemplate, 'Create an app called "My Awesome App"', []);

      expect(mockTemplatesService.interpolateTemplate).toHaveBeenCalledWith(
        mockTemplate,
        expect.objectContaining({
          appTitle: 'My Awesome App',
          appName: 'My Awesome App',
          welcomeMessage: 'Welcome to My Awesome App'
        })
      );
    });

    it('should extract app name with different patterns', () => {
      const customizeTemplate = (generator as any).customizeTemplate.bind(generator);
      const mockTemplate: AppTemplate = {
        id: 'test',
        name: 'Test',
        description: '',
        keywords: [],
        aiTags: [],
        variables: {},
        screens: [],
        metadata: { version: '', author: '', category: '' }
      };

      mockTemplatesService.interpolateTemplate.mockReturnValue(mockTemplate);

      // Test different name patterns
      const patterns = [
        'app named "Test App"',
        'app titled Test App',
        'called Test App',
        'app title Test App'
      ];

      patterns.forEach(prompt => {
        jest.clearAllMocks();
        customizeTemplate(mockTemplate, prompt, []);
        
        expect(mockTemplatesService.interpolateTemplate).toHaveBeenCalledWith(
          mockTemplate,
          expect.objectContaining({
            appTitle: 'Test App'
          })
        );
      });
    });

    it('should use keyword-based name when no explicit name found', () => {
      const customizeTemplate = (generator as any).customizeTemplate.bind(generator);
      const mockTemplate: AppTemplate = {
        id: 'test',
        name: 'Test',
        description: '',
        keywords: [],
        aiTags: [],
        variables: {},
        screens: [],
        metadata: { version: '', author: '', category: '' }
      };

      mockTemplatesService.interpolateTemplate.mockReturnValue(mockTemplate);

      customizeTemplate(mockTemplate, 'build me something', ['todo', 'task']);

      expect(mockTemplatesService.interpolateTemplate).toHaveBeenCalledWith(
        mockTemplate,
        expect.objectContaining({
          appTitle: 'Todo App'
        })
      );
    });

    it('should preserve existing template variables', () => {
      const customizeTemplate = (generator as any).customizeTemplate.bind(generator);
      const mockTemplate: AppTemplate = {
        id: 'test',
        name: 'Test',
        description: '',
        keywords: [],
        aiTags: [],
        variables: {
          existingVar: 'existing value',
          appTitle: 'Default Title'
        },
        screens: [],
        metadata: { version: '', author: '', category: '' }
      };

      mockTemplatesService.interpolateTemplate.mockReturnValue(mockTemplate);

      customizeTemplate(mockTemplate, 'simple prompt', []);

      expect(mockTemplatesService.interpolateTemplate).toHaveBeenCalledWith(
        mockTemplate,
        expect.objectContaining({
          existingVar: 'existing value'
        })
      );
    });
  });

  describe('applyOptimizations', () => {
    it('should apply rules to template screens', () => {
      const applyOptimizations = (generator as any).applyOptimizations.bind(generator);
      const mockTemplate: AppTemplate = {
        id: 'test',
        name: 'Test',
        description: '',
        keywords: [],
        aiTags: [],
        variables: {},
        screens: [{
          name: 'Screen1',
          title: 'Screen 1',
          layout: 'vertical',
          components: [
            { type: 'Header', props: { title: 'Test' }, order: 2 },
            { type: 'Button', props: { label: 'Click' }, order: 1 }
          ]
        }],
        metadata: { version: '', author: '', category: '' }
      };

      const optimizedComponents = [
        { type: 'Button', props: { label: 'Click' }, order: 1 },
        { type: 'Header', props: { title: 'Test' }, order: 2 }
      ];

      mockRulesService.applyRules.mockReturnValue(optimizedComponents);

      const result = applyOptimizations(mockTemplate, 'test prompt');

      expect(mockRulesService.applyRules).toHaveBeenCalledWith(
        mockTemplate.screens[0].components,
        expect.objectContaining({
          hasDatabase: false,
          userIntent: 'general',
          platform: 'ios',
          screenCount: 1,
          screenLayout: 'vertical'
        })
      );

      // Should sort by order
      expect(result.screens[0].components[0].order).toBe(1);
      expect(result.screens[0].components[1].order).toBe(2);
    });

    it('should handle database enabled template', () => {
      const applyOptimizations = (generator as any).applyOptimizations.bind(generator);
      const mockTemplate: AppTemplate = {
        id: 'test',
        name: 'Test',
        description: '',
        keywords: [],
        aiTags: [],
        variables: {},
        enableDatabase: true,
        screens: [{
          name: 'Screen1',
          title: 'Screen 1',
          layout: 'grid',
          components: [{ type: 'DataForm', props: {}, order: 1 }]
        }],
        metadata: { version: '', author: '', category: '' }
      };

      mockRulesService.applyRules.mockReturnValue(mockTemplate.screens[0].components);

      applyOptimizations(mockTemplate, 'data app');

      expect(mockRulesService.applyRules).toHaveBeenCalledWith(
        mockTemplate.screens[0].components,
        expect.objectContaining({
          hasDatabase: true,
          screenLayout: 'grid'
        })
      );
    });
  });

  describe('determineIntent', () => {
    it('should determine correct intent from prompts', () => {
      const determineIntent = (generator as any).determineIntent.bind(generator);

      expect(determineIntent('I want a todo list')).toBe('productivity');
      expect(determineIntent('Create a task manager')).toBe('productivity');
      expect(determineIntent('Build a dashboard with analytics')).toBe('analytics');
      expect(determineIntent('I need a blog for articles')).toBe('content');
      expect(determineIntent('Create a form to collect data')).toBe('data_collection');
      expect(determineIntent('Build a survey app')).toBe('data_collection');
      expect(determineIntent('Random application')).toBe('general');
    });

    it('should be case insensitive', () => {
      const determineIntent = (generator as any).determineIntent.bind(generator);

      expect(determineIntent('TODO LIST')).toBe('productivity');
      expect(determineIntent('DASHBOARD')).toBe('analytics');
      expect(determineIntent('BLOG')).toBe('content');
    });
  });

  describe('convertToAppSpec', () => {
    it('should convert template to app spec correctly', () => {
      const convertToAppSpec = (generator as any).convertToAppSpec.bind(generator);
      const mockTemplate: AppTemplate = {
        id: 'test',
        name: 'Test App',
        description: '',
        keywords: [],
        aiTags: [],
        variables: {},
        screens: [{
          name: 'MainScreen',
          title: 'Main',
          layout: 'vertical',
          components: [
            { type: 'Header', props: { title: 'Test' }, order: 1 },
            { type: 'Button', props: { label: 'Click' }, order: 2 }
          ]
        }],
        metadata: { version: '', author: '', category: '' }
      };

      const result = convertToAppSpec(mockTemplate);

      expect(result).toEqual({
        appName: 'Test App',
        screens: [{
          name: 'MainScreen',
          components: [
            { type: 'Header', props: { title: 'Test' } },
            { type: 'Button', props: { label: 'Click' } }
          ]
        }]
      });
    });

    it('should include database config when enabled', () => {
      const convertToAppSpec = (generator as any).convertToAppSpec.bind(generator);
      const mockTemplate: AppTemplate = {
        id: 'test',
        name: 'Test App',
        description: '',
        keywords: [],
        aiTags: [],
        variables: {},
        enableDatabase: true,
        dataCollection: 'users',
        screens: [{
          name: 'MainScreen',
          title: 'Main',
          layout: 'vertical',
          components: [{ type: 'DataForm', props: { collection: 'users' } }]
        }],
        metadata: { version: '', author: '', category: '' }
      };

      const result = convertToAppSpec(mockTemplate);

      expect(result.enableDatabase).toBe(true);
      expect(result.dataCollection).toBe('users');
    });
  });

  describe('generateFallbackApp', () => {
    it('should generate fallback app with safe title', () => {
      const generateFallbackApp = (generator as any).generateFallbackApp.bind(generator);

      const result = generateFallbackApp('This is a very long prompt that should be truncated');

      expect(result).toEqual({
        appName: 'Generated App',
        screens: [{
          name: 'MainScreen',
          components: [
            { type: 'Header', props: { title: 'This is a very long ' } },
            { 
              type: 'Card', 
              props: { 
                title: 'Welcome', 
                content: 'App generated from: "This is a very long ..."' 
              } 
            },
            { type: 'Button', props: { label: 'Get Started' } }
          ]
        }]
      });
    });

    it('should handle short prompts', () => {
      const generateFallbackApp = (generator as any).generateFallbackApp.bind(generator);

      const result = generateFallbackApp('short');

      expect(result.screens[0].components[0].props.title).toBe('short');
    });
  });

  describe('error handling', () => {
    it('should catch and log errors during generation', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      mockTemplatesService.findBestTemplate.mockImplementation(() => {
        throw new Error('Template service error');
      });

      const result = await generator.generateApp('test prompt');

      expect(consoleSpy).toHaveBeenCalledWith('Generation error:', expect.any(Error));
      expect(result.appName).toBe('Generated App');
      
      consoleSpy.mockRestore();
    });

    it('should handle null template responses gracefully', async () => {
      mockTemplatesService.findBestTemplate.mockReturnValue(null);
      mockTemplatesService.getTemplate.mockReturnValue(null);
      mockTemplatesService.interpolateTemplate.mockImplementation((template) => template);
      mockRulesService.applyRules.mockImplementation((components) => components);

      const result = await generator.generateApp('test prompt');

      expect(result).toBeDefined();
      expect(result.appName).toBeDefined();
      expect(result.screens).toBeDefined();
      expect(result.screens.length).toBeGreaterThan(0);
    });
  });
});