/**
 * Simplified Template System
 * 
 * This module provides template management functions for the AI App Generator.
 * Templates define the structure and components of generated applications.
 * 
 * Key features:
 * - Template discovery by ID, keywords, and AI tags
 * - Variable interpolation for customization
 * - Scoring-based template matching
 * - No hot reloading or complex state management for simplicity
 * 
 * @example Basic usage:
 * ```typescript
 * import { getTemplate, findBestTemplate, interpolateTemplate } from './templates';
 * 
 * // Get a specific template
 * const todoTemplate = getTemplate('todo-app');
 * 
 * // Find best matching template
 * const bestMatch = findBestTemplate(['todo', 'task', 'productivity']);
 * 
 * // Customize template with variables
 * const customized = interpolateTemplate(todoTemplate, { appTitle: 'My Tasks' });
 * ```
 */

// Simplified template system - no complex classes or hot reloading
import { allTemplates } from '../templates';

/** Template variable definitions for customization */
export interface TemplateVariable {
  [key: string]: any;
}

/** Component definition within a template screen */
export interface ComponentDefinition {
  /** Component type (must match registry) */
  type: string;
  /** Component properties and configuration */
  props: Record<string, any>;
  /** Optional display order (lower numbers appear first) */
  order?: number;
}

/** Screen definition within a template */
export interface ScreenDefinition {
  /** Unique screen identifier */
  name: string;
  /** Display title for the screen */
  title: string;
  /** Layout type for component arrangement */
  layout: 'vertical' | 'horizontal' | 'grid';
  /** Components to include in this screen */
  components: ComponentDefinition[];
}

/** Complete application template definition */
export interface AppTemplate {
  /** Unique template identifier */
  id: string;
  /** Human-readable template name */
  name: string;
  /** Detailed template description */
  description: string;
  /** Keywords for template matching */
  keywords: string[];
  /** AI tags for intelligent selection */
  aiTags: string[];
  /** Optional data collection name for database apps */
  dataCollection?: string;
  /** Whether this template requires database functionality */
  enableDatabase?: boolean;
  /** Variables available for customization */
  variables: TemplateVariable;
  /** Screen definitions for the template */
  screens: ScreenDefinition[];
  /** Template metadata */
  metadata: {
    version: string;
    author: string;
    category: string;
  };
}

// === Template Access Functions ===

/**
 * Retrieves a specific template by its unique identifier.
 * 
 * @param templateId - The unique ID of the template to retrieve
 * @returns The template if found, undefined otherwise
 * 
 * @example
 * ```typescript
 * const todoTemplate = getTemplate('todo-app');
 * if (todoTemplate) {
 *   console.log(todoTemplate.name); // "Todo List Application"
 * }
 * ```
 */
export function getTemplate(templateId: string): AppTemplate | undefined {
  return allTemplates.find(t => t.id === templateId);
}

/**
 * Returns all available templates in the system.
 * Returns a shallow copy to prevent accidental modification.
 * 
 * @returns Array of all template definitions
 * 
 * @example
 * ```typescript
 * const templates = getAllTemplates();
 * console.log(`Available: ${templates.length} templates`);
 * templates.forEach(t => console.log(`- ${t.name}`));
 * ```
 */
export function getAllTemplates(): AppTemplate[] {
  return [...allTemplates];
}

/**
 * Finds all templates that match any of the provided keywords.
 * Searches in template keywords, AI tags, name, and description.
 * 
 * @param keywords - Array of keywords to search for (case-insensitive)
 * @returns Array of matching templates
 * 
 * @example
 * ```typescript
 * const matches = findTemplatesByKeywords(['todo', 'productivity']);
 * // Returns templates that contain any of these keywords
 * ```
 */
export function findTemplatesByKeywords(keywords: string[]): AppTemplate[] {
  const lowerKeywords = keywords.map(k => k.toLowerCase());
  
  return allTemplates.filter(template => {
    const templateKeywords = template.keywords.map(k => k.toLowerCase());
    const templateTags = template.aiTags.map(t => t.toLowerCase());
    
    return lowerKeywords.some(keyword => 
      templateKeywords.includes(keyword) || 
      templateTags.includes(keyword) ||
      template.name.toLowerCase().includes(keyword) ||
      template.description.toLowerCase().includes(keyword)
    );
  });
}

/**
 * Finds the best matching template for the given keywords using a scoring algorithm.
 * 
 * Scoring system:
 * - Keywords match: +10 points each
 * - AI tags match: +5 points each  
 * - Name/description partial match: +3 points each
 * 
 * @param keywords - Keywords to match against (case-insensitive)
 * @returns Best matching template or null if no good matches (score < 5)
 * 
 * @example
 * ```typescript
 * const bestTemplate = findBestTemplate(['todo', 'task', 'productivity']);
 * if (bestTemplate) {
 *   console.log(`Best match: ${bestTemplate.name}`);
 * }
 * ```
 */
export function findBestTemplate(keywords: string[]): AppTemplate | null {
  const matches = findTemplatesByKeywords(keywords);
  if (matches.length === 0) return null;
  
  // Simple scoring: template with most keyword matches wins
  let bestTemplate = matches[0];
  let bestScore = 0;
  
  for (const template of matches) {
    const score = calculateMatchScore(keywords, template);
    if (score > bestScore) {
      bestScore = score;
      bestTemplate = template;
    }
  }
  
  return bestScore >= 5 ? bestTemplate : null;
}

function calculateMatchScore(keywords: string[], template: AppTemplate): number {
  const lowerKeywords = keywords.map(k => k.toLowerCase());
  const templateKeywords = template.keywords.map(k => k.toLowerCase());
  const templateTags = template.aiTags.map(t => t.toLowerCase());
  
  let score = 0;
  for (const keyword of lowerKeywords) {
    if (templateKeywords.includes(keyword)) score += 2;
    if (templateTags.includes(keyword)) score += 2;
    if (template.name.toLowerCase().includes(keyword)) score += 1;
    if (template.description.toLowerCase().includes(keyword)) score += 1;
  }
  
  return score;
}

// Simple template interpolation - just replace {{variable}} with values
export function interpolateTemplate(template: AppTemplate, variables?: TemplateVariable): AppTemplate {
  if (!variables || Object.keys(variables).length === 0) {
    return template;
  }
  
  // Merge variables
  const allVariables = { ...template.variables, ...variables };
  
  // Deep clone and interpolate
  const interpolated = JSON.parse(JSON.stringify(template));
  interpolateObject(interpolated, allVariables);
  
  return interpolated;
}

function interpolateObject(obj: any, variables: TemplateVariable): void {
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      obj[key] = interpolateString(obj[key], variables);
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      interpolateObject(obj[key], variables);
    }
  }
}

function interpolateString(str: string, variables: TemplateVariable): any {
  // Simple replacement: {{variableName}} -> value
  return str.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
    const value = variables[varName.trim()];
    return value !== undefined ? String(value) : match;
  });
}