// Simplified services - all functions, no complex classes
export * from './config';
export * from './templates'; 
export * from './components';
export * from './rules';

// For backward compatibility, export simplified services as classes
import { loadConfig, AppConfig } from './config';
import { 
  getTemplate, 
  getAllTemplates, 
  findBestTemplate, 
  interpolateTemplate,
  AppTemplate 
} from './templates';
import { getComponentByType, findComponentsByTags } from './components';
import { applyRules } from './rules';

// Simple wrapper "classes" that just use the functions
export class ConfigLoader {
  getConfig(): AppConfig {
    return loadConfig();
  }
}

export class TemplateLoader {
  getTemplate(id: string) {
    return getTemplate(id);
  }
  
  getAllTemplates() {
    return getAllTemplates();
  }
  
  findTemplatesByKeywords(keywords: string[]) {
    return findBestTemplate(keywords) ? [findBestTemplate(keywords)!] : [];
  }
  
  interpolateTemplate(template: AppTemplate, variables?: any) {
    return interpolateTemplate(template, variables);
  }
  
  enableHotReload() {
    // No-op for simplified version
  }
}

export class ComponentMapper {
  findComponentByType(type: string) {
    return getComponentByType(type);
  }
  
  findComponentsByTags(tags: string[]) {
    return findComponentsByTags(tags);
  }
}

export class RuleEngine {
  applyComponentRules(components: any[], context: any) {
    return applyRules(components, context);
  }
}