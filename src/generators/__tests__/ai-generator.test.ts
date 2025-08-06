import { AIAppGenerator, type AppSpec, type ComponentSpec, type ScreenSpec } from '../ai-generator';
import { generateObject } from 'ai';

// Mock the AI SDK
jest.mock('ai', () => ({
  generateObject: jest.fn(),
}));

jest.mock('@ai-sdk/openai', () => ({
  openai: jest.fn(),
  createOpenAI: jest.fn(() => jest.fn()),
}));

jest.mock('@ai-sdk/anthropic', () => ({
  anthropic: jest.fn(),
  createAnthropic: jest.fn(() => jest.fn()),
}));

jest.mock('../../../src/config/ai-config', () => ({
  AI_CONFIG: {
    provider: 'openai',
    apiKey: '',
    model: 'gpt-4o-mini',
    temperature: 0.7,
  },
  SYSTEM_PROMPT: 'Test system prompt',
}));

describe('AIAppGenerator', () => {
  let generator: AIAppGenerator;
  const mockGenerateObject = generateObject as jest.MockedFunction<typeof generateObject>;

  beforeEach(() => {
    jest.clearAllMocks();
    generator = new AIAppGenerator();
  });

  describe('constructor', () => {
    it('should initialize with OpenAI provider when configured', () => {
      expect(() => new AIAppGenerator()).not.toThrow();
    });

    it('should initialize with Anthropic provider when configured', () => {
      jest.doMock('../../../src/config/ai-config', () => ({
        AI_CONFIG: {
          provider: 'anthropic',
          apiKey: 'test-key',
          model: 'claude-3-5-sonnet-20241022',
          temperature: 0.7,
        },
        SYSTEM_PROMPT: 'Test system prompt',
      }));
      
      expect(() => new AIAppGenerator()).not.toThrow();
    });
  });

  describe('generateApp', () => {
    describe('with API key configured', () => {
      beforeEach(() => {
        // Mock AI_CONFIG to have an API key
        jest.doMock('../../../src/config/ai-config', () => ({
          AI_CONFIG: {
            provider: 'openai',
            apiKey: 'test-api-key',
            model: 'gpt-4o-mini',
            temperature: 0.7,
          },
          SYSTEM_PROMPT: 'Test system prompt',
        }));
      });

      it('should use AI API for generation when API key is available', async () => {
        const mockAppSpec: AppSpec = {
          appName: 'AI Generated Todo App',
          screens: [{
            name: 'MainScreen',
            components: [{
              type: 'Header',
              props: { title: 'AI Todo List' }
            }]
          }],
          dataCollection: 'todos',
          enableDatabase: true,
        };

        mockGenerateObject.mockResolvedValueOnce({
          object: mockAppSpec,
          finishReason: 'stop',
          usage: { promptTokens: 100, completionTokens: 200 },
        });

        const result = await generator.generateApp('Create a todo app');

        expect(mockGenerateObject).toHaveBeenCalledWith({
          model: expect.any(Function),
          schema: expect.any(Object),
          system: 'Test system prompt',
          prompt: 'Create a todo app',
          temperature: 0.7,
        });

        expect(result).toEqual(mockAppSpec);
      });

      it('should fallback to hardcoded logic when AI API fails', async () => {
        mockGenerateObject.mockRejectedValueOnce(new Error('API Error'));

        const result = await generator.generateApp('Create a todo app');

        expect(result).toMatchObject({
          appName: 'Todo List App',
          dataCollection: 'todos',
          enableDatabase: true,
        });
      });

      it('should handle network timeouts gracefully', async () => {
        const timeoutError = new Error('Request timeout');
        timeoutError.name = 'TimeoutError';
        mockGenerateObject.mockRejectedValueOnce(timeoutError);

        const result = await generator.generateApp('Create a blog app');

        expect(result).toMatchObject({
          appName: 'Blog App',
          dataCollection: 'posts',
          enableDatabase: true,
        });
      });
    });

    describe('without API key (fallback mode)', () => {
      beforeEach(() => {
        // Reset to no API key configuration
        jest.doMock('../../../src/config/ai-config', () => ({
          AI_CONFIG: {
            provider: 'openai',
            apiKey: '',
            model: 'gpt-4o-mini',
            temperature: 0.7,
          },
          SYSTEM_PROMPT: 'Test system prompt',
        }));
        generator = new AIAppGenerator();
      });

      it('should generate todo app for todo-related prompts', async () => {
        const todoPrompts = [
          'Create a todo app',
          'I need a task manager',
          'Build a TODO list application',
          'Make an app for managing tasks',
        ];

        for (const prompt of todoPrompts) {
          const result = await generator.generateApp(prompt);
          
          expect(result).toMatchObject({
            appName: 'Todo List App',
            dataCollection: 'todos',
            enableDatabase: true,
            screens: [{
              name: 'MainScreen',
              components: expect.arrayContaining([
                expect.objectContaining({ type: 'Header' }),
                expect.objectContaining({ type: 'DataForm' }),
                expect.objectContaining({ type: 'DataList' }),
              ])
            }]
          });
        }
      });

      it('should generate dashboard app for dashboard-related prompts', async () => {
        const dashboardPrompts = [
          'Create a dashboard',
          'I need analytics dashboard',
          'Build a dashboard application',
        ];

        for (const prompt of dashboardPrompts) {
          const result = await generator.generateApp(prompt);
          
          expect(result).toMatchObject({
            appName: 'Dashboard App',
            screens: [{
              name: 'DashboardScreen',
              components: expect.arrayContaining([
                expect.objectContaining({ type: 'Header' }),
                expect.objectContaining({ type: 'Card' }),
                expect.objectContaining({ type: 'List' }),
              ])
            }]
          });
        }
      });

      it('should generate blog app for blog-related prompts', async () => {
        const blogPrompts = [
          'Create a blog app',
          'I need an article management system',
          'Build a blog platform',
        ];

        for (const prompt of blogPrompts) {
          const result = await generator.generateApp(prompt);
          
          expect(result).toMatchObject({
            appName: 'Blog App',
            dataCollection: 'posts',
            enableDatabase: true,
            screens: [{
              name: 'BlogScreen',
              components: expect.arrayContaining([
                expect.objectContaining({ type: 'Header' }),
                expect.objectContaining({ type: 'DataForm' }),
                expect.objectContaining({ type: 'DataList' }),
              ])
            }]
          });
        }
      });

      it('should generate default app for unrecognized prompts', async () => {
        const result = await generator.generateApp('Something completely different');
        
        expect(result).toMatchObject({
          appName: 'Generated App',
          screens: [{
            name: 'MainScreen',
            components: expect.arrayContaining([
              expect.objectContaining({ 
                type: 'Header',
                props: { title: 'Something completely dif' } // truncated to 20 chars
              }),
              expect.objectContaining({ type: 'Card' }),
              expect.objectContaining({ type: 'Button' }),
            ])
          }]
        });
      });
    });
  });

  describe('component structure validation', () => {
    it('should generate valid component structures', async () => {
      const result = await generator.generateApp('Create a todo app');
      
      // Validate AppSpec structure
      expect(result).toHaveProperty('appName');
      expect(result).toHaveProperty('screens');
      expect(Array.isArray(result.screens)).toBe(true);
      
      // Validate ScreenSpec structure
      result.screens.forEach(screen => {
        expect(screen).toHaveProperty('name');
        expect(screen).toHaveProperty('components');
        expect(Array.isArray(screen.components)).toBe(true);
        
        // Validate ComponentSpec structure
        screen.components.forEach(component => {
          expect(component).toHaveProperty('type');
          expect(component).toHaveProperty('props');
          expect(typeof component.type).toBe('string');
          expect(typeof component.props).toBe('object');
        });
      });
    });

    it('should generate components with required props', async () => {
      const result = await generator.generateApp('Create a todo app');
      const mainScreen = result.screens[0];
      
      const headerComponent = mainScreen.components.find(c => c.type === 'Header');
      expect(headerComponent?.props).toHaveProperty('title');
      
      const dataFormComponent = mainScreen.components.find(c => c.type === 'DataForm');
      expect(dataFormComponent?.props).toHaveProperty('collection');
      expect(dataFormComponent?.props).toHaveProperty('fields');
      expect(dataFormComponent?.props).toHaveProperty('submitLabel');
      
      const dataListComponent = mainScreen.components.find(c => c.type === 'DataList');
      expect(dataListComponent?.props).toHaveProperty('collection');
    });
  });

  describe('error handling', () => {
    it('should handle malformed AI responses', async () => {
      mockGenerateObject.mockResolvedValueOnce({
        object: null,
        finishReason: 'error',
        usage: { promptTokens: 0, completionTokens: 0 },
      });

      const result = await generator.generateApp('Create a todo app');
      
      // Should fallback to hardcoded logic
      expect(result).toMatchObject({
        appName: 'Todo List App',
        dataCollection: 'todos',
        enableDatabase: true,
      });
    });

    it('should handle API rate limiting', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      rateLimitError.name = 'RateLimitError';
      mockGenerateObject.mockRejectedValueOnce(rateLimitError);

      const result = await generator.generateApp('Create a dashboard');
      
      // Should fallback gracefully
      expect(result).toMatchObject({
        appName: 'Dashboard App',
      });
    });

    it('should handle authentication errors', async () => {
      const authError = new Error('Invalid API key');
      authError.name = 'AuthenticationError';
      mockGenerateObject.mockRejectedValueOnce(authError);

      const result = await generator.generateApp('Create a blog');
      
      // Should fallback gracefully
      expect(result).toMatchObject({
        appName: 'Blog App',
      });
    });
  });

  describe('performance', () => {
    it('should generate apps within reasonable time limits', async () => {
      const startTime = Date.now();
      await generator.generateApp('Create a todo app');
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second for fallback
    });

    it('should handle concurrent generation requests', async () => {
      const promises = Array.from({ length: 5 }, () => 
        generator.generateApp('Create a todo app')
      );
      
      const results = await Promise.all(promises);
      
      // All should succeed
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toMatchObject({
          appName: 'Todo List App',
        });
      });
    });
  });

  describe('prompt processing', () => {
    it('should be case insensitive', async () => {
      const prompts = [
        'CREATE A TODO APP',
        'create a todo app',
        'Create A Todo App',
        'CrEaTe A tOdO aPp',
      ];

      for (const prompt of prompts) {
        const result = await generator.generateApp(prompt);
        expect(result.appName).toBe('Todo List App');
      }
    });

    it('should handle empty prompts gracefully', async () => {
      const result = await generator.generateApp('');
      
      expect(result).toMatchObject({
        appName: 'Generated App',
        screens: expect.arrayContaining([
          expect.objectContaining({
            name: 'MainScreen',
            components: expect.any(Array),
          })
        ]),
      });
    });

    it('should handle very long prompts', async () => {
      const longPrompt = 'a'.repeat(1000);
      const result = await generator.generateApp(longPrompt);
      
      expect(result).toBeDefined();
      expect(result.appName).toBe('Generated App');
      expect(result.screens[0].components[0].props.title).toHaveLength(20); // Truncated
    });
  });
});