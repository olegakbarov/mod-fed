// Simplified generator exports - one main generator
export { SimpleAIGenerator, AppSpec, ScreenSpec, ComponentSpec } from './simple-generator';

// Re-export for backward compatibility
export { SimpleAIGenerator as AIAppGenerator } from './simple-generator';
export { SimpleAIGenerator as DynamicAIAppGenerator } from './simple-generator';

// Default export
export { SimpleAIGenerator as default } from './simple-generator';