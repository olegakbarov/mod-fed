import * as fs from 'fs';
import * as path from 'path';

export interface TemplateVariable {
  [key: string]: any;
}

export interface ComponentDefinition {
  type: string;
  props: Record<string, any>;
  order?: number;
  conditions?: Record<string, any>;
  fallback?: ComponentDefinition | ComponentDefinition[];
  repeat?: string;
}

export interface ScreenDefinition {
  name: string;
  title: string;
  layout: 'vertical' | 'horizontal' | 'grid';
  components: ComponentDefinition[];
}

export interface AppTemplate {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  aiTags: string[];
  dataCollection?: string;
  enableDatabase?: boolean;
  variables: TemplateVariable;
  screens: ScreenDefinition[];
  metadata: {
    version: string;
    author: string;
    category: string;
    difficulty: string;
    estimatedTime: string;
  };
}

export class TemplateLoader {
  private templates: Map<string, AppTemplate> = new Map();
  private templateDir: string;
  private fileWatchers: Map<string, any> = new Map();

  constructor(templateDir: string = path.join(__dirname, '../templates')) {
    this.templateDir = templateDir;
    this.loadAllTemplates();
  }

  private loadAllTemplates(): void {
    try {
      const files = fs.readdirSync(this.templateDir);
      const templateFiles = files.filter(f => f.endsWith('.json'));
      
      for (const file of templateFiles) {
        this.loadTemplate(file);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  }

  private loadTemplate(filename: string): void {
    try {
      const filePath = path.join(this.templateDir, filename);
      const content = fs.readFileSync(filePath, 'utf-8');
      const template = JSON.parse(content) as AppTemplate;
      
      this.templates.set(template.id, template);
      console.log(`Loaded template: ${template.id}`);
    } catch (error) {
      console.error(`Error loading template ${filename}:`, error);
    }
  }

  public getTemplate(templateId: string): AppTemplate | undefined {
    return this.templates.get(templateId);
  }

  public getAllTemplates(): AppTemplate[] {
    return Array.from(this.templates.values());
  }

  public findTemplatesByKeywords(keywords: string[]): AppTemplate[] {
    const lowerKeywords = keywords.map(k => k.toLowerCase());
    
    return this.getAllTemplates().filter(template => {
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

  public findTemplateByAITags(tags: string[]): AppTemplate | null {
    const templates = this.getAllTemplates();
    let bestMatch: AppTemplate | null = null;
    let bestScore = 0;
    
    for (const template of templates) {
      const score = this.calculateTagMatchScore(tags, template.aiTags);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = template;
      }
    }
    
    return bestMatch;
  }

  private calculateTagMatchScore(searchTags: string[], templateTags: string[]): number {
    const lowerSearchTags = searchTags.map(t => t.toLowerCase());
    const lowerTemplateTags = templateTags.map(t => t.toLowerCase());
    
    let score = 0;
    for (const searchTag of lowerSearchTags) {
      if (lowerTemplateTags.includes(searchTag)) {
        score += 2; // Exact match
      } else {
        // Partial match
        for (const templateTag of lowerTemplateTags) {
          if (templateTag.includes(searchTag) || searchTag.includes(templateTag)) {
            score += 1;
          }
        }
      }
    }
    
    return score;
  }

  public interpolateTemplate(template: AppTemplate, customVariables?: TemplateVariable): AppTemplate {
    const variables = { ...template.variables, ...customVariables };
    const interpolated = JSON.parse(JSON.stringify(template)); // Deep clone
    
    // Recursively interpolate variables in the template
    this.interpolateObject(interpolated, variables);
    
    return interpolated;
  }

  private interpolateObject(obj: any, variables: TemplateVariable): void {
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        obj[key] = this.interpolateString(obj[key], variables);
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        this.interpolateObject(obj[key], variables);
      }
    }
  }

  private interpolateString(str: string, variables: TemplateVariable): any {
    // Handle direct variable references
    if (str.startsWith('{{') && str.endsWith('}}')) {
      const varName = str.slice(2, -2).trim();
      return this.getNestedValue(variables, varName);
    }
    
    // Handle inline variable substitution
    return str.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
      const value = this.getNestedValue(variables, varName.trim());
      return value !== undefined ? String(value) : match;
    });
  }

  private getNestedValue(obj: any, path: string): any {
    const parts = path.split('.');
    let current = obj;
    
    for (const part of parts) {
      if (current === undefined || current === null) {
        return undefined;
      }
      current = current[part];
    }
    
    return current;
  }

  public enableHotReload(onChange?: (template: AppTemplate) => void): void {
    if (typeof fs.watch !== 'function') {
      console.warn('File watching not available');
      return;
    }

    try {
      const watcher = fs.watch(this.templateDir, (eventType, filename) => {
        if (filename && filename.endsWith('.json')) {
          console.log(`Template file changed: ${filename}`);
          this.loadTemplate(filename);
          
          if (onChange) {
            const templateId = filename.replace('.json', '');
            const template = this.templates.get(templateId);
            if (template) {
              onChange(template);
            }
          }
        }
      });
      
      this.fileWatchers.set('main', watcher);
    } catch (error) {
      console.error('Error setting up file watcher:', error);
    }
  }

  public disableHotReload(): void {
    for (const watcher of this.fileWatchers.values()) {
      watcher.close();
    }
    this.fileWatchers.clear();
  }

  public reload(): void {
    this.templates.clear();
    this.loadAllTemplates();
  }
}