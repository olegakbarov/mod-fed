# API Documentation

This document provides comprehensive API documentation for the simplified AI App Generator system.

## Table of Contents

1. [Core Generator API](#core-generator-api)
2. [Services API](#services-api)
3. [Template API](#template-api)
4. [Component API](#component-api)
5. [Rules API](#rules-api)
6. [Configuration API](#configuration-api)
7. [Utility APIs](#utility-apis)
8. [Type Definitions](#type-definitions)

## Core Generator API

### SimpleAIGenerator

The main class for generating applications from natural language prompts.

```typescript
import { SimpleAIGenerator } from './src/generators/simple-generator';

const generator = new SimpleAIGenerator();
```

#### Methods

##### `generateApp(userPrompt: string): Promise<AppSpec>`

Generates a complete app specification from a natural language prompt.

**Parameters:**
- `userPrompt` (string): Natural language description of the desired app

**Returns:**
- `Promise<AppSpec>`: Complete app specification ready for rendering

**Example:**
```typescript
const appSpec = await generator.generateApp("Create a todo list app called My Tasks");

console.log(appSpec);
// {
//   appName: "My Tasks",
//   screens: [{
//     name: "MainScreen",
//     components: [
//       { type: "Header", props: { title: "My Tasks" } },
//       { type: "DataForm", props: { collection: "todos", ... } },
//       { type: "DataList", props: { collection: "todos", ... } }
//     ]
//   }],
//   enableDatabase: true,
//   dataCollection: "todos"
// }
```

**Error Handling:**
- Returns a fallback app specification if generation fails
- Logs errors to console for debugging
- Never throws exceptions

## Services API

### Template Service

Functions for managing and working with app templates.

```typescript
import { 
  getTemplate, 
  getAllTemplates, 
  findBestTemplate, 
  interpolateTemplate 
} from './src/services/templates';
```

#### `getTemplate(id: string): AppTemplate | null`

Retrieves a specific template by its ID.

**Parameters:**
- `id` (string): Template identifier ('todo-app', 'dashboard-app', 'blog-app', 'generic-app')

**Returns:**
- `AppTemplate | null`: Template object or null if not found

**Example:**
```typescript
const todoTemplate = getTemplate('todo-app');
if (todoTemplate) {
  console.log(todoTemplate.name); // "Todo List Application"
  console.log(todoTemplate.keywords); // ['todo', 'task', 'checklist', ...]
}
```

#### `getAllTemplates(): AppTemplate[]`

Returns all available templates.

**Returns:**
- `AppTemplate[]`: Array of all template objects

**Example:**
```typescript
const templates = getAllTemplates();
console.log(`Available templates: ${templates.length}`);
templates.forEach(t => console.log(`- ${t.name}: ${t.description}`));
```

#### `findBestTemplate(keywords: string[]): AppTemplate | null`

Finds the best matching template based on keywords using a scoring algorithm.

**Parameters:**
- `keywords` (string[]): Array of keywords to match against

**Returns:**
- `AppTemplate | null`: Best matching template or null if no good match

**Example:**
```typescript
const template = findBestTemplate(['todo', 'task', 'productivity']);
if (template) {
  console.log(`Best match: ${template.name}`); // "Todo List Application"
}
```

**Scoring Algorithm:**
- Keywords match: +10 points each
- AI tags match: +5 points each
- Returns template with highest score (minimum 5 points required)

#### `interpolateTemplate(template: AppTemplate, variables?: Record<string, any>): AppTemplate`

Replaces template variables with actual values.

**Parameters:**
- `template` (AppTemplate): Template to interpolate
- `variables` (Record<string, any>, optional): Variables to substitute

**Returns:**
- `AppTemplate`: New template with variables replaced

**Example:**
```typescript
const template = getTemplate('todo-app')!;
const customized = interpolateTemplate(template, {
  appTitle: "My Custom Tasks",
  submitLabel: "Add New Task"
});

// All {{appTitle}} and {{submitLabel}} placeholders are now replaced
console.log(customized.screens[0].components[0].props.title); // "My Custom Tasks"
```

**Variable Syntax:**
- Use `{{variableName}}` in template strings
- Supports nested objects and arrays
- Handles missing variables gracefully (keeps placeholder)

### Component Service

Functions for discovering and working with components.

```typescript
import { 
  getComponentByType, 
  findComponentsByTags, 
  findComponentsByKeywords 
} from './src/services/components';
```

#### `getComponentByType(type: string): ComponentDefinition | null`

Retrieves component definition by type name.

**Parameters:**
- `type` (string): Component type (e.g., 'Button', 'DataForm', 'Header')

**Returns:**
- `ComponentDefinition | null`: Component definition or null if not found

**Example:**
```typescript
const buttonDef = getComponentByType('Button');
if (buttonDef) {
  console.log(buttonDef.description); // "Interactive button component"
  console.log(buttonDef.requiredProps); // ['label']
}
```

#### `findComponentsByTags(tags: string[]): ComponentMatch[]`

Finds components that match specified AI tags, with relevance scoring.

**Parameters:**
- `tags` (string[]): Array of AI tags to search for

**Returns:**
- `ComponentMatch[]`: Array of components with match scores, sorted by relevance

**Example:**
```typescript
const matches = findComponentsByTags(['productivity', 'form']);
matches.forEach(match => {
  console.log(`${match.component.type}: score ${match.score}`);
});
// DataForm: score 15
// Button: score 8
// TextInput: score 5
```

**Scoring:**
- Exact tag match: +10 points
- Partial tag match: +5 points
- Category match: +3 points
- Results sorted by score (descending)

#### `findComponentsByKeywords(keywords: string[]): ComponentDefinition[]`

Finds components by searching keywords in descriptions and properties.

**Parameters:**
- `keywords` (string[]): Keywords to search for

**Returns:**
- `ComponentDefinition[]`: Array of matching components

**Example:**
```typescript
const formComponents = findComponentsByKeywords(['input', 'form', 'submit']);
// Returns: [DataForm, TextInput, Button]
```

### Rules Service

Functions for applying component optimization rules.

```typescript
import { applyRules } from './src/services/rules';
```

#### `applyRules(components: ComponentSpec[], context: RuleContext): ComponentSpec[]`

Applies all optimization rules to a set of components.

**Parameters:**
- `components` (ComponentSpec[]): Components to optimize
- `context` (RuleContext): Context information for rule application

**Returns:**
- `ComponentSpec[]`: Optimized component array

**Example:**
```typescript
const context: RuleContext = {
  hasDatabase: true,
  userIntent: 'productivity',
  platform: 'ios',
  screenCount: 1
};

const optimizedComponents = applyRules(originalComponents, context);
// Rules applied: database setup, mobile limits, header ordering, card grids
```

**Built-in Rules:**

1. **DatabaseRule**: Adds database connectivity when `hasDatabase: true`
2. **MobileLimitRule**: Limits components to 5 per screen on mobile platforms
3. **HeaderFirstRule**: Ensures Header components appear first (order: 1)
4. **GridCardsRule**: Applies grid layout to Card components

**Rule Context Properties:**
```typescript
interface RuleContext {
  hasDatabase?: boolean;     // Whether app needs database
  userIntent?: string;       // User's intent (productivity, analytics, etc.)
  platform?: 'ios' | 'android' | 'web';
  screenCount?: number;      // Number of screens in app
  screenLayout?: 'vertical' | 'horizontal' | 'grid';
}
```

### Configuration Service

Functions for managing system configuration.

```typescript
import { loadConfig, getEnvironment, isProduction } from './src/services/config';
```

#### `loadConfig(): AppConfig`

Loads the current application configuration.

**Returns:**
- `AppConfig`: Current configuration object

**Example:**
```typescript
const config = loadConfig();
console.log(config.environment); // 'development' | 'production'
console.log(config.features.enableHotReload); // boolean
```

#### `getEnvironment(): string`

Returns the current environment name.

**Returns:**
- `string`: Environment name ('development', 'production', or 'test')

#### `isProduction(): boolean`

Checks if running in production environment.

**Returns:**
- `boolean`: True if production environment

**Configuration Schema:**
```typescript
interface AppConfig {
  environment: 'development' | 'production' | 'test';
  platform: 'react-native' | 'node';
  features: {
    enableHotReload: boolean;
    enableDebugLogs: boolean;
    enableMetrics: boolean;
  };
  generator: {
    maxComponentsPerScreen: number;
    defaultTemplate: string;
    enableFallbacks: boolean;
  };
  api: {
    componentServerUrl?: string;
    timeout: number;
  };
}
```

## Utility APIs

### Validation Utilities

```typescript
import { validateAppSpec, validatePrompt, sanitizeInput } from './src/utils/validation';
```

#### `validateAppSpec(spec: any): AppSpec | null`

Validates and sanitizes an app specification object.

**Parameters:**
- `spec` (any): Object to validate as AppSpec

**Returns:**
- `AppSpec | null`: Valid AppSpec or null if validation fails

#### `validatePrompt(prompt: string): string | null`

Validates and sanitizes user input prompts.

**Parameters:**
- `prompt` (string): User input to validate

**Returns:**
- `string | null`: Sanitized prompt or null if invalid

#### `sanitizeInput(input: string): string`

Sanitizes user input by removing potentially harmful content.

**Parameters:**
- `input` (string): Input to sanitize

**Returns:**
- `string`: Sanitized input

### Error Utilities

```typescript
import { AppError, handleGenerationError, createErrorResponse } from './src/utils/errors';
```

#### `AppError`

Custom error class for application errors.

**Example:**
```typescript
throw new AppError('Template not found', 'TEMPLATE_ERROR', { templateId: 'invalid' });
```

#### `handleGenerationError(error: Error): AppSpec`

Handles generation errors and returns fallback app specification.

**Parameters:**
- `error` (Error): Error that occurred during generation

**Returns:**
- `AppSpec`: Fallback app specification

## Type Definitions

### Core Types

```typescript
// App specification returned by generator
interface AppSpec {
  appName: string;
  screens: ScreenSpec[];
  dataCollection?: string;
  enableDatabase?: boolean;
}

// Screen specification
interface ScreenSpec {
  name: string;
  components: ComponentSpec[];
}

// Component specification
interface ComponentSpec {
  type: string;
  props: Record<string, any>;
}
```

### Template Types

```typescript
// Complete template definition
interface AppTemplate {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  aiTags: string[];
  dataCollection?: string;
  enableDatabase?: boolean;
  variables: Record<string, any>;
  screens: ScreenDefinition[];
  metadata: TemplateMetadata;
}

// Screen definition in template
interface ScreenDefinition {
  name: string;
  title: string;
  layout: 'vertical' | 'horizontal' | 'grid';
  components: ComponentDefinition[];
}

// Component definition in template
interface ComponentDefinition {
  type: string;
  props: Record<string, any>;
  order?: number;
  conditions?: {
    requiresDatabase?: boolean;
    platform?: 'ios' | 'android' | 'web';
  };
}

// Template metadata
interface TemplateMetadata {
  version: string;
  author: string;
  category: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime?: string;
}
```

### Component Registry Types

```typescript
// Component definition in registry
interface ComponentDefinition {
  type: string;
  category: string;
  aiTags: string[];
  description: string;
  requiredProps: string[];
  optionalProps: Record<string, string>;
  examples?: ComponentExample[];
}

// Component match with score
interface ComponentMatch {
  component: ComponentDefinition;
  score: number;
}

// Component example
interface ComponentExample {
  name: string;
  description: string;
  props: Record<string, any>;
}
```

### Rule Types

```typescript
// Rule definition
interface ComponentRule {
  name: string;
  condition: (context: RuleContext) => boolean;
  apply: (components: ComponentSpec[]) => ComponentSpec[];
}

// Rule application context
interface RuleContext {
  hasDatabase?: boolean;
  userIntent?: string;
  platform?: 'ios' | 'android' | 'web';
  screenCount?: number;
  screenLayout?: 'vertical' | 'horizontal' | 'grid';
}
```

## Error Handling

All API functions handle errors gracefully:

1. **Validation Errors**: Invalid inputs return `null` or empty arrays
2. **Generation Errors**: Return fallback specifications instead of throwing
3. **Missing Resources**: Return `null` for single items, empty arrays for collections
4. **System Errors**: Logged to console, graceful degradation applied

## Performance Considerations

- **Template Matching**: O(n) complexity, <10ms for typical datasets
- **Component Discovery**: Uses indexed lookups, O(1) for type-based queries
- **Rule Application**: O(n) per rule, all rules applied in sequence
- **Memory Usage**: <50MB for full system with all templates loaded

## Integration Examples

### React Native Integration

```typescript
import React, { useState } from 'react';
import { SimpleAIGenerator } from './src/generators/simple-generator';

const AppGeneratorScreen: React.FC = () => {
  const [generator] = useState(new SimpleAIGenerator());
  const [appSpec, setAppSpec] = useState<AppSpec | null>(null);
  const [loading, setLoading] = useState(false);

  const generateApp = async (prompt: string) => {
    setLoading(true);
    try {
      const spec = await generator.generateApp(prompt);
      setAppSpec(spec);
    } catch (error) {
      console.error('Generation failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    // Your React Native UI here
  );
};
```

### Node.js Integration

```typescript
import { SimpleAIGenerator } from './src/generators/simple-generator';

const generator = new SimpleAIGenerator();

// Generate app from command line
const args = process.argv.slice(2);
const prompt = args.join(' ');

generator.generateApp(prompt).then(appSpec => {
  console.log('Generated app:', JSON.stringify(appSpec, null, 2));
});
```

### Custom Service Integration

```typescript
import { 
  getTemplate, 
  findComponentsByTags, 
  applyRules 
} from './src/services';

// Build a custom generator
class CustomGenerator {
  async generateCustomApp(requirements: Requirements): Promise<AppSpec> {
    // 1. Select template based on custom logic
    const template = this.selectTemplate(requirements);
    
    // 2. Find components using AI tags
    const componentMatches = findComponentsByTags(requirements.tags);
    
    // 3. Apply custom rules
    const optimizedComponents = applyRules(
      componentMatches.map(m => m.component),
      this.buildContext(requirements)
    );
    
    // 4. Build final specification
    return this.buildAppSpec(template, optimizedComponents);
  }
}
```

This API documentation provides complete coverage of all public interfaces in the simplified AI App Generator system. All functions include proper error handling, type safety, and performance optimizations.