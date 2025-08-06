/**
 * Comprehensive tests for services index (wrapper classes)
 */

import {
  ConfigLoader,
  TemplateLoader,
  ComponentMapper,
  RuleEngine
} from '../index';
import * as configService from '../config';
import * as templatesService from '../templates';
import * as componentsService from '../components';
import * as rulesService from '../rules';
import { AppTemplate, ComponentDefinition } from '../templates';
import { RuleContext } from '../rules';

// Mock the underlying services
jest.mock('../config');
jest.mock('../templates');
jest.mock('../components');
jest.mock('../rules');

const mockConfigService = configService as jest.Mocked<typeof configService>;
const mockTemplatesService = templatesService as jest.Mocked<typeof templatesService>;
const mockComponentsService = componentsService as jest.Mocked<typeof componentsService>;
const mockRulesService = rulesService as jest.Mocked<typeof rulesService>;

describe('Services Index - Wrapper Classes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ConfigLoader', () => {
    let configLoader: ConfigLoader;

    beforeEach(() => {
      configLoader = new ConfigLoader();
    });

    it('should be instantiable', () => {
      expect(configLoader).toBeInstanceOf(ConfigLoader);
    });

    describe('getConfig', () => {
      it('should call the underlying loadConfig function', () => {
        const mockConfig = {
          version: '1.0.0',
          environment: 'development' as const,
          features: {
            hotReload: true,
            aiIntegration: true,
            databaseEnabled: true,
            remoteComponents: false
          },
          api: {
            baseUrl: 'http://localhost:3002',
            timeout: 30000
          },
          componentServer: {
            url: 'http://localhost:3001',
            port: 3001,
            fallbackToLocal: true
          },
          ai: {
            provider: 'local' as const,
            maxTokens: 2000
          }
        };

        mockConfigService.loadConfig.mockReturnValue(mockConfig);

        const result = configLoader.getConfig();

        expect(mockConfigService.loadConfig).toHaveBeenCalledTimes(1);
        expect(result).toEqual(mockConfig);
      });

      it('should return the same result as direct function call', () => {
        const mockConfig = {
          version: '2.0.0',
          environment: 'production' as const,
          features: {
            hotReload: false,
            aiIntegration: true,
            databaseEnabled: false,
            remoteComponents: true
          },
          api: {
            baseUrl: 'https://api.production.com',
            timeout: 15000
          },
          componentServer: {
            url: 'https://components.production.com',
            port: 443,
            fallbackToLocal: false
          },
          ai: {
            provider: 'openai' as const,
            apiKey: 'test-key',
            maxTokens: 4000
          }
        };

        mockConfigService.loadConfig.mockReturnValue(mockConfig);

        const wrapperResult = configLoader.getConfig();
        const directResult = configService.loadConfig();

        expect(wrapperResult).toEqual(directResult);
      });

      it('should handle multiple calls correctly', () => {
        const mockConfig = {
          version: '1.0.0',
          environment: 'development' as const,
          features: { hotReload: true, aiIntegration: true, databaseEnabled: true, remoteComponents: false },
          api: { baseUrl: 'http://localhost:3002', timeout: 30000 },
          componentServer: { url: 'http://localhost:3001', port: 3001, fallbackToLocal: true },
          ai: { provider: 'local' as const, maxTokens: 2000 }
        };

        mockConfigService.loadConfig.mockReturnValue(mockConfig);

        configLoader.getConfig();
        configLoader.getConfig();
        configLoader.getConfig();

        expect(mockConfigService.loadConfig).toHaveBeenCalledTimes(3);
      });
    });
  });

  describe('TemplateLoader', () => {
    let templateLoader: TemplateLoader;
    const mockTemplate: AppTemplate = {
      id: 'test-template',
      name: 'Test Template',
      description: 'A test template',
      keywords: ['test'],
      aiTags: ['testing'],
      variables: { title: 'Test App' },
      screens: [{
        name: 'TestScreen',
        title: 'Test',
        layout: 'vertical',
        components: [{ type: 'Header', props: { title: 'Test' }, order: 1 }]
      }],
      metadata: { version: '1.0.0', author: 'Test', category: 'Test' }
    };

    beforeEach(() => {
      templateLoader = new TemplateLoader();
    });

    it('should be instantiable', () => {
      expect(templateLoader).toBeInstanceOf(TemplateLoader);
    });

    describe('getTemplate', () => {
      it('should call the underlying getTemplate function', () => {
        mockTemplatesService.getTemplate.mockReturnValue(mockTemplate);

        const result = templateLoader.getTemplate('test-template');

        expect(mockTemplatesService.getTemplate).toHaveBeenCalledWith('test-template');
        expect(result).toEqual(mockTemplate);
      });

      it('should return undefined for non-existent template', () => {
        mockTemplatesService.getTemplate.mockReturnValue(undefined);

        const result = templateLoader.getTemplate('non-existent');

        expect(mockTemplatesService.getTemplate).toHaveBeenCalledWith('non-existent');
        expect(result).toBeUndefined();
      });

      it('should handle null and undefined input', () => {
        mockTemplatesService.getTemplate.mockReturnValue(undefined);

        templateLoader.getTemplate(null as any);
        templateLoader.getTemplate(undefined as any);

        expect(mockTemplatesService.getTemplate).toHaveBeenCalledWith(null);
        expect(mockTemplatesService.getTemplate).toHaveBeenCalledWith(undefined);
      });
    });

    describe('getAllTemplates', () => {
      it('should call the underlying getAllTemplates function', () => {
        const mockTemplates = [mockTemplate];
        mockTemplatesService.getAllTemplates.mockReturnValue(mockTemplates);

        const result = templateLoader.getAllTemplates();

        expect(mockTemplatesService.getAllTemplates).toHaveBeenCalledTimes(1);
        expect(result).toEqual(mockTemplates);
      });

      it('should return empty array when no templates exist', () => {
        mockTemplatesService.getAllTemplates.mockReturnValue([]);

        const result = templateLoader.getAllTemplates();

        expect(result).toEqual([]);
      });
    });

    describe('findTemplatesByKeywords', () => {
      it('should find templates using findBestTemplate', () => {
        mockTemplatesService.findBestTemplate.mockReturnValue(mockTemplate);

        const result = templateLoader.findTemplatesByKeywords(['test']);

        expect(mockTemplatesService.findBestTemplate).toHaveBeenCalledWith(['test']);
        expect(result).toEqual([mockTemplate]);
      });

      it('should return empty array when no template found', () => {
        mockTemplatesService.findBestTemplate.mockReturnValue(null);

        const result = templateLoader.findTemplatesByKeywords(['nonexistent']);

        expect(mockTemplatesService.findBestTemplate).toHaveBeenCalledWith(['nonexistent']);
        expect(result).toEqual([]);
      });

      it('should handle empty keywords array', () => {
        mockTemplatesService.findBestTemplate.mockReturnValue(null);

        const result = templateLoader.findTemplatesByKeywords([]);

        expect(mockTemplatesService.findBestTemplate).toHaveBeenCalledWith([]);
        expect(result).toEqual([]);
      });

      it('should handle multiple keywords', () => {
        mockTemplatesService.findBestTemplate.mockReturnValue(mockTemplate);

        const result = templateLoader.findTemplatesByKeywords(['test', 'template', 'sample']);

        expect(mockTemplatesService.findBestTemplate).toHaveBeenCalledWith(['test', 'template', 'sample']);
        expect(result).toEqual([mockTemplate]);
      });
    });

    describe('interpolateTemplate', () => {
      it('should call the underlying interpolateTemplate function', () => {
        const variables = { title: 'Custom Title', subtitle: 'Custom Subtitle' };
        const interpolatedTemplate = { ...mockTemplate, variables };

        mockTemplatesService.interpolateTemplate.mockReturnValue(interpolatedTemplate);

        const result = templateLoader.interpolateTemplate(mockTemplate, variables);

        expect(mockTemplatesService.interpolateTemplate).toHaveBeenCalledWith(mockTemplate, variables);
        expect(result).toEqual(interpolatedTemplate);
      });

      it('should handle undefined variables', () => {
        mockTemplatesService.interpolateTemplate.mockReturnValue(mockTemplate);

        const result = templateLoader.interpolateTemplate(mockTemplate);

        expect(mockTemplatesService.interpolateTemplate).toHaveBeenCalledWith(mockTemplate, undefined);
        expect(result).toEqual(mockTemplate);
      });

      it('should handle empty variables object', () => {
        mockTemplatesService.interpolateTemplate.mockReturnValue(mockTemplate);

        const result = templateLoader.interpolateTemplate(mockTemplate, {});

        expect(mockTemplatesService.interpolateTemplate).toHaveBeenCalledWith(mockTemplate, {});
        expect(result).toEqual(mockTemplate);
      });
    });

    describe('enableHotReload', () => {
      it('should be a no-op function', () => {
        // Should not throw any errors
        expect(() => templateLoader.enableHotReload()).not.toThrow();
      });

      it('should not call any underlying services', () => {
        templateLoader.enableHotReload();

        expect(mockTemplatesService.getTemplate).not.toHaveBeenCalled();
        expect(mockTemplatesService.getAllTemplates).not.toHaveBeenCalled();
        expect(mockTemplatesService.findBestTemplate).not.toHaveBeenCalled();
        expect(mockTemplatesService.interpolateTemplate).not.toHaveBeenCalled();
      });
    });
  });

  describe('ComponentMapper', () => {
    let componentMapper: ComponentMapper;
    const mockComponent = {
      id: 'test-component',
      name: 'Test Component',
      version: '1.0.0',
      type: 'TestComponent',
      category: 'utility' as const,
      description: 'A test component',
      aiTags: ['test', 'utility'],
      props: [{ name: 'title', type: 'string' as const, required: true }],
      capabilities: ['testing'],
      compatibility: { platforms: ['ios' as const, 'android' as const] }
    };

    beforeEach(() => {
      componentMapper = new ComponentMapper();
    });

    it('should be instantiable', () => {
      expect(componentMapper).toBeInstanceOf(ComponentMapper);
    });

    describe('findComponentByType', () => {
      it('should call the underlying getComponentByType function', () => {
        mockComponentsService.getComponentByType.mockReturnValue(mockComponent);

        const result = componentMapper.findComponentByType('TestComponent');

        expect(mockComponentsService.getComponentByType).toHaveBeenCalledWith('TestComponent');
        expect(result).toEqual(mockComponent);
      });

      it('should return undefined for non-existent component type', () => {
        mockComponentsService.getComponentByType.mockReturnValue(undefined);

        const result = componentMapper.findComponentByType('NonExistentComponent');

        expect(mockComponentsService.getComponentByType).toHaveBeenCalledWith('NonExistentComponent');
        expect(result).toBeUndefined();
      });

      it('should handle empty and invalid input', () => {
        mockComponentsService.getComponentByType.mockReturnValue(undefined);

        componentMapper.findComponentByType('');
        componentMapper.findComponentByType(null as any);
        componentMapper.findComponentByType(undefined as any);

        expect(mockComponentsService.getComponentByType).toHaveBeenCalledWith('');
        expect(mockComponentsService.getComponentByType).toHaveBeenCalledWith(null);
        expect(mockComponentsService.getComponentByType).toHaveBeenCalledWith(undefined);
      });
    });

    describe('findComponentsByTags', () => {
      it('should call the underlying findComponentsByTags function', () => {
        const mockMatches = [
          { component: mockComponent, score: 5 },
          { component: { ...mockComponent, type: 'AnotherComponent' }, score: 3 }
        ];

        mockComponentsService.findComponentsByTags.mockReturnValue(mockMatches);

        const result = componentMapper.findComponentsByTags(['test', 'utility']);

        expect(mockComponentsService.findComponentsByTags).toHaveBeenCalledWith(['test', 'utility']);
        expect(result).toEqual(mockMatches);
      });

      it('should return empty array when no matches found', () => {
        mockComponentsService.findComponentsByTags.mockReturnValue([]);

        const result = componentMapper.findComponentsByTags(['nonexistent']);

        expect(mockComponentsService.findComponentsByTags).toHaveBeenCalledWith(['nonexistent']);
        expect(result).toEqual([]);
      });

      it('should handle empty tags array', () => {
        mockComponentsService.findComponentsByTags.mockReturnValue([]);

        const result = componentMapper.findComponentsByTags([]);

        expect(mockComponentsService.findComponentsByTags).toHaveBeenCalledWith([]);
        expect(result).toEqual([]);
      });

      it('should preserve the structure of ComponentMatch results', () => {
        const mockMatches = [
          { component: mockComponent, score: 10 }
        ];

        mockComponentsService.findComponentsByTags.mockReturnValue(mockMatches);

        const result = componentMapper.findComponentsByTags(['test']);

        expect(result).toHaveLength(1);
        expect(result[0]).toHaveProperty('component');
        expect(result[0]).toHaveProperty('score');
        expect(typeof result[0].score).toBe('number');
        expect(result[0].component).toHaveProperty('type');
      });
    });
  });

  describe('RuleEngine', () => {
    let ruleEngine: RuleEngine;
    const mockComponents: ComponentDefinition[] = [
      { type: 'Header', props: { title: 'Test' }, order: 1 },
      { type: 'Button', props: { label: 'Click' }, order: 2 }
    ];

    beforeEach(() => {
      ruleEngine = new RuleEngine();
    });

    it('should be instantiable', () => {
      expect(ruleEngine).toBeInstanceOf(RuleEngine);
    });

    describe('applyComponentRules', () => {
      it('should call the underlying applyRules function', () => {
        const mockContext: RuleContext = {
          hasDatabase: true,
          platform: 'ios',
          userIntent: 'productivity'
        };

        const optimizedComponents = [
          { type: 'Header', props: { title: 'Test' }, order: 1 },
          { type: 'Button', props: { label: 'Click' }, order: 2 }
        ];

        mockRulesService.applyRules.mockReturnValue(optimizedComponents);

        const result = ruleEngine.applyComponentRules(mockComponents, mockContext);

        expect(mockRulesService.applyRules).toHaveBeenCalledWith(mockComponents, mockContext);
        expect(result).toEqual(optimizedComponents);
      });

      it('should handle empty components array', () => {
        const mockContext: RuleContext = { hasDatabase: false };
        mockRulesService.applyRules.mockReturnValue([]);

        const result = ruleEngine.applyComponentRules([], mockContext);

        expect(mockRulesService.applyRules).toHaveBeenCalledWith([], mockContext);
        expect(result).toEqual([]);
      });

      it('should handle empty context object', () => {
        mockRulesService.applyRules.mockReturnValue(mockComponents);

        const result = ruleEngine.applyComponentRules(mockComponents, {});

        expect(mockRulesService.applyRules).toHaveBeenCalledWith(mockComponents, {});
        expect(result).toEqual(mockComponents);
      });

      it('should preserve component structure', () => {
        const complexComponents: ComponentDefinition[] = [
          {
            type: 'DataForm',
            props: {
              collection: 'users',
              fields: [
                { name: 'email', type: 'email' },
                { name: 'name', type: 'text' }
              ],
              validation: { required: ['email', 'name'] }
            },
            order: 1
          }
        ];

        mockRulesService.applyRules.mockReturnValue(complexComponents);

        const result = ruleEngine.applyComponentRules(complexComponents, { hasDatabase: true });

        expect(result).toEqual(complexComponents);
        expect(result[0]).toHaveProperty('type');
        expect(result[0]).toHaveProperty('props');
        expect(result[0]).toHaveProperty('order');
        expect(result[0].props).toHaveProperty('collection');
        expect(result[0].props).toHaveProperty('fields');
      });

      it('should handle different context types', () => {
        const contexts: RuleContext[] = [
          { hasDatabase: true, platform: 'ios' },
          { hasDatabase: false, platform: 'android', screenLayout: 'grid' },
          { userIntent: 'analytics', componentCount: 5 },
          { screenCount: 3, platform: 'web' }
        ];

        contexts.forEach((context, index) => {
          mockRulesService.applyRules.mockReturnValue(mockComponents);
          
          const result = ruleEngine.applyComponentRules(mockComponents, context);
          
          expect(mockRulesService.applyRules).toHaveBeenCalledWith(mockComponents, context);
          expect(result).toBeDefined();
        });

        expect(mockRulesService.applyRules).toHaveBeenCalledTimes(contexts.length);
      });
    });
  });

  describe('Integration between wrapper classes', () => {
    it('should work together in a typical workflow', () => {
      const configLoader = new ConfigLoader();
      const templateLoader = new TemplateLoader();
      const componentMapper = new ComponentMapper();
      const ruleEngine = new RuleEngine();

      // Mock a complete workflow
      const mockConfig = {
        version: '1.0.0',
        environment: 'development' as const,
        features: { hotReload: true, aiIntegration: true, databaseEnabled: true, remoteComponents: false },
        api: { baseUrl: 'http://localhost:3002', timeout: 30000 },
        componentServer: { url: 'http://localhost:3001', port: 3001, fallbackToLocal: true },
        ai: { provider: 'local' as const, maxTokens: 2000 }
      };

      const mockWorkflowTemplate: AppTemplate = {
        id: 'workflow-template',
        name: 'Workflow Template',
        description: 'Template for testing workflow',
        keywords: ['workflow'],
        aiTags: ['test'],
        variables: { title: 'Test' },
        screens: [{
          name: 'WorkflowScreen',
          title: 'Workflow',
          layout: 'vertical',
          components: [{ type: 'Header', props: { title: 'Workflow' }, order: 1 }]
        }],
        metadata: { version: '1.0.0', author: 'Test', category: 'Test' }
      };

      const mockWorkflowComponent = {
        id: 'header-workflow',
        name: 'Workflow Header',
        version: '1.0.0',
        type: 'Header',
        category: 'navigation' as const,
        description: 'Header for workflow',
        aiTags: ['navigation'],
        props: [{ name: 'title', type: 'string' as const, required: true }],
        capabilities: ['navigation'],
        compatibility: { platforms: ['ios' as const] }
      };

      mockConfigService.loadConfig.mockReturnValue(mockConfig);
      mockTemplatesService.getTemplate.mockReturnValue(mockWorkflowTemplate);
      mockComponentsService.getComponentByType.mockReturnValue(mockWorkflowComponent);
      mockRulesService.applyRules.mockReturnValue(mockWorkflowTemplate.screens[0].components);

      // Execute workflow
      const config = configLoader.getConfig();
      const template = templateLoader.getTemplate('workflow-template');
      const component = componentMapper.findComponentByType('Header');
      const optimizedComponents = ruleEngine.applyComponentRules(
        template!.screens[0].components,
        { hasDatabase: config.features.databaseEnabled }
      );

      // Verify workflow
      expect(config).toBeDefined();
      expect(template).toBeDefined();
      expect(component).toBeDefined();
      expect(optimizedComponents).toBeDefined();

      expect(mockConfigService.loadConfig).toHaveBeenCalled();
      expect(mockTemplatesService.getTemplate).toHaveBeenCalledWith('workflow-template');
      expect(mockComponentsService.getComponentByType).toHaveBeenCalledWith('Header');
      expect(mockRulesService.applyRules).toHaveBeenCalledWith(
        mockWorkflowTemplate.screens[0].components,
        { hasDatabase: true }
      );
    });

    it('should maintain independence between instances', () => {
      const loader1 = new TemplateLoader();
      const loader2 = new TemplateLoader();
      const mapper1 = new ComponentMapper();
      const mapper2 = new ComponentMapper();

      expect(loader1).not.toBe(loader2);
      expect(mapper1).not.toBe(mapper2);

      // Each instance should work independently
      const mockIndependentTemplate: AppTemplate = {
        id: 'independent-template',
        name: 'Independent Template',
        description: 'Template for independence test',
        keywords: ['independent'],
        aiTags: ['test'],
        variables: { title: 'Independent' },
        screens: [{
          name: 'IndependentScreen',
          title: 'Independent',
          layout: 'vertical',
          components: [{ type: 'Button', props: { label: 'Independent' }, order: 1 }]
        }],
        metadata: { version: '1.0.0', author: 'Test', category: 'Test' }
      };

      const mockIndependentComponent = {
        id: 'independent-component',
        name: 'Independent Component',
        version: '1.0.0',
        type: 'IndependentComponent',
        category: 'utility' as const,
        description: 'Component for independence test',
        aiTags: ['independent'],
        props: [{ name: 'value', type: 'string' as const, required: true }],
        capabilities: ['testing'],
        compatibility: { platforms: ['ios' as const] }
      };

      mockTemplatesService.getTemplate.mockReturnValue(mockIndependentTemplate);
      mockComponentsService.getComponentByType.mockReturnValue(mockIndependentComponent);

      loader1.getTemplate('template1');
      loader2.getTemplate('template2');
      mapper1.findComponentByType('Component1');
      mapper2.findComponentByType('Component2');

      expect(mockTemplatesService.getTemplate).toHaveBeenCalledWith('template1');
      expect(mockTemplatesService.getTemplate).toHaveBeenCalledWith('template2');
      expect(mockComponentsService.getComponentByType).toHaveBeenCalledWith('Component1');
      expect(mockComponentsService.getComponentByType).toHaveBeenCalledWith('Component2');
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle service function errors gracefully', () => {
      const templateLoader = new TemplateLoader();
      
      mockTemplatesService.getTemplate.mockImplementation(() => {
        throw new Error('Service error');
      });

      expect(() => templateLoader.getTemplate('test')).toThrow('Service error');
    });

    it('should handle undefined return values correctly', () => {
      const componentMapper = new ComponentMapper();
      
      mockComponentsService.getComponentByType.mockReturnValue(undefined);
      mockComponentsService.findComponentsByTags.mockReturnValue([]);

      expect(componentMapper.findComponentByType('NonExistent')).toBeUndefined();
      expect(componentMapper.findComponentsByTags(['none'])).toEqual([]);
    });

    it('should handle null parameters without breaking', () => {
      const ruleEngine = new RuleEngine();
      
      mockRulesService.applyRules.mockReturnValue([]);

      expect(() => ruleEngine.applyComponentRules(null as any, null as any)).not.toThrow();
      expect(mockRulesService.applyRules).toHaveBeenCalledWith(null, null);
    });
  });

  describe('backward compatibility', () => {
    it('should maintain the same API as the original classes', () => {
      // Test that all expected methods exist
      const configLoader = new ConfigLoader();
      const templateLoader = new TemplateLoader();
      const componentMapper = new ComponentMapper();
      const ruleEngine = new RuleEngine();

      expect(typeof configLoader.getConfig).toBe('function');
      expect(typeof templateLoader.getTemplate).toBe('function');
      expect(typeof templateLoader.getAllTemplates).toBe('function');
      expect(typeof templateLoader.findTemplatesByKeywords).toBe('function');
      expect(typeof templateLoader.interpolateTemplate).toBe('function');
      expect(typeof templateLoader.enableHotReload).toBe('function');
      expect(typeof componentMapper.findComponentByType).toBe('function');
      expect(typeof componentMapper.findComponentsByTags).toBe('function');
      expect(typeof ruleEngine.applyComponentRules).toBe('function');
    });

    it('should have the same method signatures', () => {
      const templateLoader = new TemplateLoader();
      const mockSignatureTemplate: AppTemplate = {
        id: 'signature-template',
        name: 'Signature Template',
        description: 'Template for signature test',
        keywords: ['signature'],
        aiTags: ['test'],
        variables: { title: 'Signature' },
        screens: [{
          name: 'SignatureScreen',
          title: 'Signature',
          layout: 'vertical',
          components: [{ type: 'Header', props: { title: 'Signature' }, order: 1 }]
        }],
        metadata: { version: '1.0.0', author: 'Test', category: 'Test' }
      };
      
      mockTemplatesService.getTemplate.mockReturnValue(mockSignatureTemplate);

      // These should not throw type errors
      templateLoader.getTemplate('string-param');
      templateLoader.findTemplatesByKeywords(['array', 'of', 'strings']);
      templateLoader.interpolateTemplate(mockSignatureTemplate, { key: 'value' });
      templateLoader.enableHotReload(); // No parameters
    });
  });
});