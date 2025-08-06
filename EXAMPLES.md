# Usage Examples

This document provides comprehensive examples of how to use the AI App Generator system in various scenarios and use cases.

## Table of Contents

1. [Basic Usage](#basic-usage)
2. [Advanced Generation](#advanced-generation)
3. [Custom Templates](#custom-templates)
4. [Service Integration](#service-integration)
5. [React Native Integration](#react-native-integration)
6. [Testing Examples](#testing-examples)
7. [Production Usage](#production-usage)

## Basic Usage

### Simple App Generation

```typescript
import { SimpleAIGenerator } from './src/generators/simple-generator';

const generator = new SimpleAIGenerator();

// Generate a simple app
const appSpec = await generator.generateApp("Create a todo list app");

console.log(appSpec);
// Output:
// {
//   appName: "Todo List Application",
//   screens: [{
//     name: "MainScreen",
//     components: [
//       { type: "Header", props: { title: "Todo List Application" } },
//       { type: "DataForm", props: { collection: "todos", ... } },
//       { type: "DataList", props: { collection: "todos", ... } }
//     ]
//   }],
//   enableDatabase: true,
//   dataCollection: "todos"
// }
```

### Common Prompts and Results

```typescript
const generator = new SimpleAIGenerator();

// Productivity Apps
const todoApp = await generator.generateApp("Create a task manager called MyTasks");
const reminderApp = await generator.generateApp("Build a reminder app");
const checklistApp = await generator.generateApp("Make a simple checklist");

// Analytics Apps
const dashboardApp = await generator.generateApp("Build a metrics dashboard");
const reportApp = await generator.generateApp("Create a reporting app");
const analyticsApp = await generator.generateApp("Make an analytics viewer");

// Content Apps
const blogApp = await generator.generateApp("Create a blog reader");
const newsApp = await generator.generateApp("Build a news app called Daily Updates");
const articleApp = await generator.generateApp("Make an article viewer");
```

### Error Handling

```typescript
import { SimpleAIGenerator } from './src/generators/simple-generator';

const generator = new SimpleAIGenerator();

try {
  const appSpec = await generator.generateApp("Create an app with invalid requirements");
  // The generator never throws - it returns a fallback app instead
  console.log('Generated app:', appSpec.appName);
} catch (error) {
  // This will never execute - the generator has comprehensive error handling
  console.error('This should not happen:', error);
}

// Example of fallback app
const fallbackApp = await generator.generateApp("???invalid???");
console.log(fallbackApp);
// Output:
// {
//   appName: "Generated App",
//   screens: [{
//     name: "MainScreen",
//     components: [
//       { type: "Header", props: { title: "???invalid???" } },
//       { type: "Card", props: { title: "Welcome", content: "App generated from: \"???invalid???...\"" } },
//       { type: "Button", props: { label: "Get Started" } }
//     ]
//   }]
// }
```

## Advanced Generation

### Using Services Directly

```typescript
import { 
  getTemplate, 
  findBestTemplate, 
  interpolateTemplate,
  findComponentsByTags,
  applyRules
} from './src/services';

// Advanced template selection
const keywords = ['todo', 'productivity', 'task'];
const bestTemplate = findBestTemplate(keywords);

if (bestTemplate) {
  console.log(`Selected: ${bestTemplate.name}`);
  console.log(`Score: ${calculateScore(keywords, bestTemplate)}`);
}

// Custom template customization
const customizedTemplate = interpolateTemplate(bestTemplate!, {
  appTitle: 'My Custom Task App',
  submitLabel: 'Add New Task',
  welcomeMessage: 'Welcome to your personal task manager'
});

// Advanced component selection
const productivityComponents = findComponentsByTags(['productivity', 'form']);
console.log('Productivity components:', productivityComponents.map(c => c.component.type));

// Apply optimization rules
const context = {
  hasDatabase: true,
  userIntent: 'productivity',
  platform: 'ios' as const,
  screenCount: 1
};

const optimizedComponents = applyRules(
  productivityComponents.map(c => c.component), 
  context
);
console.log('Optimized components:', optimizedComponents.length);
```

### Template Scoring Example

```typescript
import { findBestTemplate } from './src/services/templates';

// Test different keyword combinations
const testCases = [
  ['todo', 'task'],           // Should match todo-app template
  ['dashboard', 'analytics'], // Should match dashboard-app template  
  ['blog', 'article'],        // Should match blog-app template
  ['generic', 'basic'],       // Should match generic-app template
  ['shopping', 'ecommerce'],  // Should return null (no match)
];

testCases.forEach(keywords => {
  const template = findBestTemplate(keywords);
  console.log(`Keywords: [${keywords.join(', ')}]`);
  console.log(`Result: ${template?.name || 'No match'}`);
  console.log('---');
});
```

### Component Discovery Examples

```typescript
import { 
  getComponentByType, 
  findComponentsByTags, 
  findComponentsByKeywords 
} from './src/services/components';

// Direct component lookup
const buttonComponent = getComponentByType('Button');
if (buttonComponent) {
  console.log(`Button component: ${buttonComponent.description}`);
  console.log(`Required props: ${buttonComponent.requiredProps.join(', ')}`);
}

// Tag-based discovery with scoring
const formComponents = findComponentsByTags(['form', 'input', 'data']);
console.log('Form-related components:');
formComponents.forEach(match => {
  console.log(`- ${match.component.type} (score: ${match.score})`);
});
// Output:
// - DataForm (score: 20)
// - TextInput (score: 15)
// - Button (score: 10)

// Keyword search
const interactiveComponents = findComponentsByKeywords(['button', 'click', 'action']);
console.log('Interactive components:', interactiveComponents.map(c => c.type));
```

## Custom Templates

### Creating a Custom Template

```typescript
// src/templates/custom-app.ts
import { AppTemplate } from '../services/templates';

export const customAppTemplate: AppTemplate = {
  id: 'custom-app',
  name: 'Custom Business App',
  description: 'A customizable business application template',
  keywords: ['business', 'custom', 'professional'],
  aiTags: ['business', 'professional', 'customizable'],
  dataCollection: 'business_data',
  enableDatabase: true,
  variables: {
    businessName: 'My Business',
    primaryColor: '#007AFF',
    logoUrl: 'https://example.com/logo.png',
    features: [
      { name: 'Dashboard', enabled: true },
      { name: 'Reports', enabled: true },
      { name: 'Settings', enabled: false }
    ]
  },
  screens: [
    {
      name: 'MainScreen',
      title: 'Business Dashboard',
      layout: 'vertical',
      components: [
        {
          type: 'Header',
          props: {
            title: '{{businessName}}',
            backgroundColor: '{{primaryColor}}',
            logo: '{{logoUrl}}'
          },
          order: 1
        },
        {
          type: 'Card',
          props: {
            title: 'Welcome',
            content: 'Welcome to {{businessName}} management system'
          },
          order: 2
        },
        {
          type: 'DataList',
          props: {
            collection: '{{dataCollection}}',
            displayFields: ['name', 'status', 'date'],
            allowEdit: true,
            allowDelete: false
          },
          order: 3
        }
      ]
    }
  ],
  metadata: {
    version: '1.0.0',
    author: 'Custom Developer',
    category: 'business'
  }
};
```

### Registering Custom Template

```typescript
// src/templates/index.ts
export { todoAppTemplate } from './todo-app';
export { dashboardAppTemplate } from './dashboard-app';
export { blogAppTemplate } from './blog-app';
export { genericAppTemplate } from './generic-app';
export { customAppTemplate } from './custom-app';  // Add your custom template

// The template is automatically available to the generator
import { getAllTemplates } from '../services/templates';

const templates = getAllTemplates();
console.log(`Available templates: ${templates.length}`);
// Now includes your custom template
```

### Using Custom Template

```typescript
import { SimpleAIGenerator } from './src/generators/simple-generator';

const generator = new SimpleAIGenerator();

// The generator will automatically find your custom template
const businessApp = await generator.generateApp(
  "Create a business app for my company"
);

console.log(businessApp.appName); // "Custom Business App"
```

## Service Integration

### Building a Custom Generator

```typescript
import { 
  findBestTemplate, 
  interpolateTemplate,
  findComponentsByTags,
  applyRules,
  AppTemplate 
} from './src/services';

class EnhancedAIGenerator {
  async generateApp(prompt: string, customOptions: CustomOptions): Promise<AppSpec> {
    // 1. Enhanced keyword extraction
    const keywords = this.extractAdvancedKeywords(prompt);
    const intent = this.determineDetailedIntent(prompt);
    
    // 2. Smart template selection
    const template = this.selectTemplateWithFallback(keywords, intent);
    
    // 3. Advanced customization
    const variables = this.extractVariables(prompt, customOptions);
    const customized = interpolateTemplate(template, variables);
    
    // 4. Enhanced component optimization
    const context = {
      ...this.buildContext(prompt, customOptions),
      customRules: customOptions.rules || []
    };
    
    const optimized = this.applyAdvancedOptimization(customized, context);
    
    // 5. Final specification
    return this.buildFinalSpec(optimized, customOptions);
  }

  private extractAdvancedKeywords(prompt: string): string[] {
    // Advanced NLP processing
    const basicKeywords = prompt.toLowerCase().split(/\s+/);
    const synonyms = this.expandWithSynonyms(basicKeywords);
    const entities = this.extractEntities(prompt);
    
    return [...basicKeywords, ...synonyms, ...entities];
  }

  private selectTemplateWithFallback(keywords: string[], intent: string): AppTemplate {
    // Try keyword matching first
    let template = findBestTemplate(keywords);
    
    if (!template) {
      // Fallback to intent-based selection
      template = this.selectByIntent(intent);
    }
    
    if (!template) {
      // Final fallback
      template = this.getGenericTemplate();
    }
    
    return template;
  }

  // ... more custom methods
}

interface CustomOptions {
  theme?: 'light' | 'dark';
  platform?: 'ios' | 'android';
  features?: string[];
  rules?: CustomRule[];
}
```

### API Integration Example

```typescript
import { SimpleAIGenerator } from './src/generators/simple-generator';

class APIIntegratedGenerator {
  private baseGenerator = new SimpleAIGenerator();
  
  async generateWithAIEnhancement(prompt: string): Promise<AppSpec> {
    // 1. Enhance prompt with external AI service
    const enhancedPrompt = await this.enhancePromptWithAI(prompt);
    
    // 2. Use enhanced prompt with existing generator
    const appSpec = await this.baseGenerator.generateApp(enhancedPrompt);
    
    // 3. Post-process with AI recommendations
    const optimizedSpec = await this.optimizeWithAI(appSpec, prompt);
    
    return optimizedSpec;
  }

  private async enhancePromptWithAI(prompt: string): Promise<string> {
    try {
      const response = await fetch('/api/enhance-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      
      const data = await response.json();
      return data.enhancedPrompt || prompt;
    } catch (error) {
      console.warn('AI enhancement failed, using original prompt:', error);
      return prompt;
    }
  }

  private async optimizeWithAI(appSpec: AppSpec, originalPrompt: string): Promise<AppSpec> {
    try {
      const response = await fetch('/api/optimize-app', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appSpec, originalPrompt })
      });
      
      const data = await response.json();
      return data.optimizedAppSpec || appSpec;
    } catch (error) {
      console.warn('AI optimization failed, using original spec:', error);
      return appSpec;
    }
  }
}
```

## React Native Integration

### Complete React Native Component

```typescript
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert
} from 'react-native';
import { SimpleAIGenerator, AppSpec } from '../src/generators/simple-generator';

const AppGeneratorScreen: React.FC = () => {
  const [generator] = useState(() => new SimpleAIGenerator());
  const [prompt, setPrompt] = useState('');
  const [appSpec, setAppSpec] = useState<AppSpec | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<Array<{prompt: string, appSpec: AppSpec}>>([]);

  const generateApp = useCallback(async () => {
    if (!prompt.trim()) {
      Alert.alert('Error', 'Please enter a description for your app');
      return;
    }

    setLoading(true);
    try {
      const spec = await generator.generateApp(prompt);
      setAppSpec(spec);
      setHistory(prev => [...prev, { prompt, appSpec: spec }]);
      setPrompt('');
    } catch (error) {
      Alert.alert('Error', 'Failed to generate app. Please try again.');
      console.error('Generation error:', error);
    } finally {
      setLoading(false);
    }
  }, [generator, prompt]);

  const renderAppSpec = (spec: AppSpec) => (
    <View style={styles.appSpec}>
      <Text style={styles.appTitle}>{spec.appName}</Text>
      <Text style={styles.screenCount}>
        {spec.screens.length} screen{spec.screens.length !== 1 ? 's' : ''}
      </Text>
      
      {spec.screens.map((screen, index) => (
        <View key={index} style={styles.screen}>
          <Text style={styles.screenName}>{screen.name}</Text>
          <Text style={styles.componentCount}>
            {screen.components.length} components
          </Text>
          
          {screen.components.map((component, compIndex) => (
            <View key={compIndex} style={styles.component}>
              <Text style={styles.componentType}>{component.type}</Text>
              <Text style={styles.componentProps}>
                {Object.keys(component.props).length} props
              </Text>
            </View>
          ))}
        </View>
      ))}
      
      {spec.enableDatabase && (
        <Text style={styles.database}>
          Database: {spec.dataCollection || 'enabled'}
        </Text>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>AI App Generator</Text>
      
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={prompt}
          onChangeText={setPrompt}
          placeholder="Describe your app (e.g., 'Create a todo list app')"
          multiline
          editable={!loading}
        />
        
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={generateApp}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Generating...' : 'Generate App'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {appSpec && (
          <View>
            <Text style={styles.sectionTitle}>Generated App</Text>
            {renderAppSpec(appSpec)}
          </View>
        )}

        {history.length > 0 && (
          <View style={styles.history}>
            <Text style={styles.sectionTitle}>History</Text>
            {history.slice(-3).reverse().map((item, index) => (
              <View key={index} style={styles.historyItem}>
                <Text style={styles.historyPrompt}>"{item.prompt}"</Text>
                {renderAppSpec(item.appSpec)}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  inputContainer: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    borderRadius: 6,
    minHeight: 80,
    marginBottom: 12,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  appSpec: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  appTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  screenCount: {
    color: '#666',
    marginBottom: 8,
  },
  screen: {
    backgroundColor: '#f8f8f8',
    padding: 12,
    borderRadius: 6,
    marginBottom: 8,
  },
  screenName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  componentCount: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  component: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  componentType: {
    fontSize: 12,
    fontWeight: '500',
  },
  componentProps: {
    fontSize: 12,
    color: '#666',
  },
  database: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 8,
    fontStyle: 'italic',
  },
  history: {
    marginTop: 16,
  },
  historyItem: {
    marginBottom: 16,
  },
  historyPrompt: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#666',
    marginBottom: 8,
  },
});

export default AppGeneratorScreen;
```

### React Hook for App Generation

```typescript
import { useState, useCallback } from 'react';
import { SimpleAIGenerator, AppSpec } from '../src/generators/simple-generator';

interface UseAppGeneratorResult {
  generateApp: (prompt: string) => Promise<void>;
  currentApp: AppSpec | null;
  isLoading: boolean;
  error: string | null;
  history: Array<{prompt: string; appSpec: AppSpec; timestamp: Date}>;
  clearHistory: () => void;
  regenerateLastApp: () => Promise<void>;
}

export const useAppGenerator = (): UseAppGeneratorResult => {
  const [generator] = useState(() => new SimpleAIGenerator());
  const [currentApp, setCurrentApp] = useState<AppSpec | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<{prompt: string; appSpec: AppSpec; timestamp: Date}>>([]);

  const generateApp = useCallback(async (prompt: string) => {
    if (!prompt.trim()) {
      setError('Please provide a description for your app');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const appSpec = await generator.generateApp(prompt);
      setCurrentApp(appSpec);
      setHistory(prev => [...prev, {
        prompt: prompt.trim(),
        appSpec,
        timestamp: new Date()
      }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate app');
    } finally {
      setIsLoading(false);
    }
  }, [generator]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    setCurrentApp(null);
    setError(null);
  }, []);

  const regenerateLastApp = useCallback(async () => {
    const lastItem = history[history.length - 1];
    if (lastItem) {
      await generateApp(lastItem.prompt);
    }
  }, [history, generateApp]);

  return {
    generateApp,
    currentApp,
    isLoading,
    error,
    history,
    clearHistory,
    regenerateLastApp
  };
};
```

## Testing Examples

### Unit Testing Generator

```typescript
// __tests__/generator.test.ts
import { SimpleAIGenerator } from '../src/generators/simple-generator';

describe('SimpleAIGenerator', () => {
  let generator: SimpleAIGenerator;

  beforeEach(() => {
    generator = new SimpleAIGenerator();
  });

  test('generates todo app from simple prompt', async () => {
    const appSpec = await generator.generateApp('Create a todo list app');
    
    expect(appSpec.appName).toContain('Todo');
    expect(appSpec.screens).toHaveLength(1);
    expect(appSpec.enableDatabase).toBe(true);
    expect(appSpec.dataCollection).toBe('todos');
    
    const screen = appSpec.screens[0];
    expect(screen.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'Header' }),
        expect.objectContaining({ type: 'DataForm' }),
        expect.objectContaining({ type: 'DataList' })
      ])
    );
  });

  test('handles invalid input gracefully', async () => {
    const appSpec = await generator.generateApp('');
    
    expect(appSpec.appName).toBeDefined();
    expect(appSpec.screens).toHaveLength(1);
    expect(appSpec.screens[0].components.length).toBeGreaterThan(0);
  });

  test('customizes app name from prompt', async () => {
    const appSpec = await generator.generateApp('Create a todo app called "My Tasks"');
    
    expect(appSpec.appName).toContain('My Tasks');
  });
});
```

### Integration Testing with React Native

```typescript
// __tests__/integration.test.tsx
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AppGeneratorScreen from '../components/AppGeneratorScreen';

describe('AppGeneratorScreen Integration', () => {
  test('generates app from user input', async () => {
    const { getByPlaceholderText, getByText, findByText } = render(
      <AppGeneratorScreen />
    );

    const input = getByPlaceholderText(/describe your app/i);
    const button = getByText('Generate App');

    fireEvent.changeText(input, 'Create a simple todo app');
    fireEvent.press(button);

    // Wait for generation to complete
    await waitFor(() => {
      expect(getByText('Generate App')).not.toBeDisabled();
    });

    // Check that app was generated
    await findByText(/todo/i);
  });

  test('shows loading state during generation', async () => {
    const { getByPlaceholderText, getByText } = render(
      <AppGeneratorScreen />
    );

    const input = getByPlaceholderText(/describe your app/i);
    const button = getByText('Generate App');

    fireEvent.changeText(input, 'Create an app');
    fireEvent.press(button);

    expect(getByText('Generating...')).toBeTruthy();
  });
});
```

## Production Usage

### Environment Configuration

```typescript
// src/config/production.ts
import { loadConfig } from '../services/config';

const config = loadConfig();

export const productionConfig = {
  // Use production-optimized settings
  generator: {
    maxComponentsPerScreen: config.generator.maxComponentsPerScreen,
    enableFallbacks: true,
    enableMetrics: config.environment === 'production',
  },
  
  // Production API endpoints
  api: {
    componentServerUrl: process.env.COMPONENT_SERVER_URL || 'https://components.example.com',
    timeout: 5000,
  },
  
  // Performance monitoring
  monitoring: {
    enablePerformanceTracking: true,
    enableErrorReporting: true,
    sampleRate: 0.1, // 10% sampling
  }
};
```

### Performance Monitoring

```typescript
// src/utils/performance.ts
import { SimpleAIGenerator } from '../generators/simple-generator';

export class MonitoredAIGenerator extends SimpleAIGenerator {
  async generateApp(userPrompt: string) {
    const startTime = Date.now();
    const memoryStart = process.memoryUsage ? process.memoryUsage().heapUsed : 0;

    try {
      const result = await super.generateApp(userPrompt);
      
      // Log successful generation metrics
      this.logMetrics({
        type: 'generation_success',
        duration: Date.now() - startTime,
        memoryDelta: process.memoryUsage ? process.memoryUsage().heapUsed - memoryStart : 0,
        promptLength: userPrompt.length,
        resultComplexity: this.calculateComplexity(result)
      });

      return result;
    } catch (error) {
      // Log generation errors
      this.logMetrics({
        type: 'generation_error',
        duration: Date.now() - startTime,
        error: error.message
      });
      
      throw error;
    }
  }

  private calculateComplexity(appSpec: any): number {
    return appSpec.screens.reduce((total, screen) => 
      total + screen.components.length, 0
    );
  }

  private logMetrics(metrics: any) {
    if (typeof global !== 'undefined' && global.__DEV__) {
      console.log('Generator Metrics:', metrics);
    }
    
    // In production, send to monitoring service
    if (process.env.NODE_ENV === 'production') {
      // Send to analytics service
      this.sendToAnalytics(metrics);
    }
  }

  private sendToAnalytics(metrics: any) {
    // Implementation for production metrics
    fetch('/api/metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metrics)
    }).catch(error => {
      console.warn('Failed to send metrics:', error);
    });
  }
}
```

### Production Deployment

```typescript
// App.tsx - Production version
import React from 'react';
import { View } from 'react-native';
import { MonitoredAIGenerator } from './src/utils/performance';
import { productionConfig } from './src/config/production';

const generator = new MonitoredAIGenerator();

const App: React.FC = () => {
  // Production-ready app with monitoring and error boundaries
  return (
    <ErrorBoundary>
      <AppGeneratorProvider generator={generator} config={productionConfig}>
        <MainAppScreen />
      </AppGeneratorProvider>
    </ErrorBoundary>
  );
};

export default App;
```

This comprehensive examples document covers all major use cases and provides practical, production-ready code examples for integrating the AI App Generator system.