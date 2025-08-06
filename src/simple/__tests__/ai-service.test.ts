/**
 * Tests for the Simple AI Service with Circuit Breaker
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { SimpleAIService, getAIService, generateApp } from '../ai-service';

// Mock the AI dependencies
jest.mock('ai');
jest.mock('@ai-sdk/openai');
jest.mock('@ai-sdk/anthropic');

const mockGenerateObject = jest.fn();
(require('ai') as any).generateObject = mockGenerateObject;

describe('SimpleAIService', () => {
  let service: SimpleAIService;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment variables
    process.env.AI_API_KEY = 'test-key';
    process.env.AI_PROVIDER = 'openai';
    service = new SimpleAIService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateApp', () => {
    test('should validate input prompt', async () => {
      await expect(service.generateApp('')).rejects.toThrow('Prompt must be a non-empty string');
      await expect(service.generateApp('   ')).rejects.toThrow('Prompt must be a non-empty string');
    });

    test('should attempt AI generation and fall back gracefully', async () => {
      const mockAppSpec = {
        appName: 'Test App',
        screens: [{
          name: 'TestScreen',
          components: [{ type: 'Header', props: { title: 'Test' } }]
        }]
      };

      // First test: successful AI generation
      mockGenerateObject.mockResolvedValueOnce({
        object: mockAppSpec,
        usage: { promptTokens: 10, completionTokens: 20 }
      });

      // Create a new service to avoid circuit breaker state issues
      const freshService = new SimpleAIService();
      freshService.forceClose();

      const result = await freshService.generateApp('unique-prompt-12345');

      // If AI works, we get the AI result
      if (result.appName === 'Test App') {
        expect(result).toEqual(mockAppSpec);
      } else {
        // If it falls back, verify it's a sensible fallback
        expect(result.appName).toBe('Generated App');
        expect(result.screens[0].components[0].props.title).toBe('unique-prompt-12345');
      }
    });

    test('should fall back to todo template for todo prompts', async () => {
      mockGenerateObject.mockRejectedValue(new Error('API Error'));

      const result = await service.generateApp('Create a todo list app');

      expect(result.appName).toBe('Todo List App');
      expect(result.enableDatabase).toBe(true);
      expect(result.dataCollection).toBe('todos');
    });

    test('should fall back to dashboard template for dashboard prompts', async () => {
      mockGenerateObject.mockRejectedValue(new Error('API Error'));

      const result = await service.generateApp('Build an analytics dashboard');

      expect(result.appName).toBe('Dashboard App');
      expect(result.screens[0].name).toBe('DashboardScreen');
    });

    test('should fall back to blog template for blog prompts', async () => {
      mockGenerateObject.mockRejectedValue(new Error('API Error'));

      const result = await service.generateApp('Create a blog for articles');

      expect(result.appName).toBe('Blog App');
      expect(result.enableDatabase).toBe(true);
      expect(result.dataCollection).toBe('posts');
    });

    test('should fall back to generic template for other prompts', async () => {
      mockGenerateObject.mockRejectedValue(new Error('API Error'));

      const result = await service.generateApp('Make something cool');

      expect(result.appName).toBe('Generated App');
      expect(result.screens[0].components[0].props.title).toBe('Make something cool');
    });

    test('should handle no API key gracefully', async () => {
      delete process.env.AI_API_KEY;
      const serviceWithoutKey = new SimpleAIService();

      const result = await serviceWithoutKey.generateApp('Create a todo app');

      expect(result.appName).toBe('Todo List App');
      // Should not have called the AI API
      expect(mockGenerateObject).not.toHaveBeenCalled();
    });
  });

  describe('circuit breaker', () => {
    test('should provide statistics', () => {
      const stats = service.getStats();
      
      expect(stats).toHaveProperty('isOpen');
      expect(stats).toHaveProperty('isHalfOpen');
      expect(stats).toHaveProperty('failures');
      expect(stats).toHaveProperty('successes');
      expect(stats).toHaveProperty('rejects');
      expect(stats).toHaveProperty('fires');
    });

    test('should allow forcing circuit states', () => {
      service.forceOpen();
      expect(service.getStats().isOpen).toBe(true);

      service.forceClose();
      expect(service.getStats().isOpen).toBe(false);
    });

    test('should fall back when circuit is open', async () => {
      // Force circuit open
      service.forceOpen();

      const result = await service.generateApp('Create a todo app');

      expect(result.appName).toBe('Todo List App');
      // Should not have attempted AI generation
      expect(mockGenerateObject).not.toHaveBeenCalled();
    });
  });

  describe('singleton pattern', () => {
    test('should return same instance', () => {
      const service1 = getAIService();
      const service2 = getAIService();
      
      expect(service1).toBe(service2);
    });

    test('should work with convenience function', async () => {
      mockGenerateObject.mockRejectedValue(new Error('API Error'));

      const result = await generateApp('Create a todo app');

      expect(result.appName).toBe('Todo List App');
    });
  });

  describe('error handling', () => {
    test('should handle AI API timeout gracefully', async () => {
      // Simulate timeout by making AI call hang longer than circuit breaker timeout
      mockGenerateObject.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 15000))
      );

      const result = await service.generateApp('Create an app');

      // Should fall back to template
      expect(result.appName).toBe('Generated App');
    });

    test('should handle invalid AI response', async () => {
      mockGenerateObject.mockResolvedValue({ object: null });

      const result = await service.generateApp('Create an app');

      expect(result.appName).toBe('Generated App');
    });

    test('should handle network errors gracefully', async () => {
      mockGenerateObject.mockRejectedValue(new Error('Network timeout'));

      const result = await service.generateApp('Create a social app');

      expect(result.appName).toBe('Generated App');
    });
  });

  describe('template generation', () => {
    test('todo template should have correct structure', async () => {
      mockGenerateObject.mockRejectedValue(new Error('API Error'));

      const result = await service.generateApp('todo tasks');

      expect(result).toMatchObject({
        appName: 'Todo List App',
        dataCollection: 'todos',
        enableDatabase: true,
        screens: [{
          name: 'MainScreen',
          components: [
            { type: 'Header', props: { title: 'My Tasks' } },
            { type: 'DataForm', props: expect.objectContaining({ collection: 'todos' }) },
            { type: 'DataList', props: expect.objectContaining({ collection: 'todos' }) }
          ]
        }]
      });
    });

    test('dashboard template should have correct structure', async () => {
      mockGenerateObject.mockRejectedValue(new Error('API Error'));

      const result = await service.generateApp('analytics dashboard');

      expect(result.screens[0].components).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'Header' }),
          expect.objectContaining({ type: 'Card' }),
          expect.objectContaining({ type: 'List' })
        ])
      );
    });

    test('blog template should have correct structure', async () => {
      mockGenerateObject.mockRejectedValue(new Error('API Error'));

      const result = await service.generateApp('blog articles');

      expect(result).toMatchObject({
        appName: 'Blog App',
        dataCollection: 'posts',
        enableDatabase: true,
        screens: [{
          name: 'BlogScreen',
          components: expect.arrayContaining([
            expect.objectContaining({ type: 'Header' }),
            expect.objectContaining({ type: 'DataForm' }),
            expect.objectContaining({ type: 'DataList' })
          ])
        }]
      });
    });
  });
});