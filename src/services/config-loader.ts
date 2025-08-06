import * as fs from 'fs';
import * as path from 'path';

export interface AppConfig {
  version: string;
  environment: 'development' | 'staging' | 'production';
  features: {
    hotReload: boolean;
    aiIntegration: boolean;
    databaseEnabled: boolean;
    remoteComponents: boolean;
  };
  api: {
    baseUrl: string;
    timeout: number;
    retryAttempts: number;
  };
  componentServer: {
    url: string;
    port: number;
    fallbackToLocal: boolean;
  };
  ai: {
    provider: 'openai' | 'claude' | 'local';
    apiKey?: string;
    model?: string;
    maxTokens?: number;
  };
  templates: {
    directory: string;
    autoReload: boolean;
    cacheEnabled: boolean;
  };
  rules: {
    enabled: boolean;
    customRulesPath?: string;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    file?: string;
  };
}

export class ConfigLoader {
  private config: AppConfig;
  private configPath: string;
  private watchers: Map<string, any> = new Map();
  private changeListeners: Set<(config: AppConfig) => void> = new Set();
  private environmentVariables: Map<string, string> = new Map();
  
  constructor(configPath?: string) {
    this.configPath = configPath || this.findConfigFile();
    this.loadEnvironmentVariables();
    this.config = this.loadConfig();
    
    if (this.config.features.hotReload) {
      this.enableHotReload();
    }
  }
  
  private findConfigFile(): string {
    // Search for config file in multiple locations
    const searchPaths = [
      path.join(process.cwd(), 'app.config.json'),
      path.join(process.cwd(), 'config', 'app.config.json'),
      path.join(__dirname, '../../app.config.json'),
      path.join(__dirname, '../../config/app.config.json')
    ];
    
    for (const searchPath of searchPaths) {
      if (fs.existsSync(searchPath)) {
        console.log(`Found config file at: ${searchPath}`);
        return searchPath;
      }
    }
    
    // Return default config path
    return path.join(process.cwd(), 'app.config.json');
  }
  
  private loadEnvironmentVariables(): void {
    // Load environment variables that can override config
    const envVars = {
      'APP_ENV': process.env.NODE_ENV || 'development',
      'API_BASE_URL': process.env.API_BASE_URL,
      'COMPONENT_SERVER_URL': process.env.COMPONENT_SERVER_URL,
      'AI_PROVIDER': process.env.AI_PROVIDER,
      'AI_API_KEY': process.env.AI_API_KEY,
      'LOG_LEVEL': process.env.LOG_LEVEL
    };
    
    for (const [key, value] of Object.entries(envVars)) {
      if (value) {
        this.environmentVariables.set(key, value);
      }
    }
  }
  
  private loadConfig(): AppConfig {
    let config: AppConfig;
    
    try {
      // Try to load from file
      if (fs.existsSync(this.configPath)) {
        const content = fs.readFileSync(this.configPath, 'utf-8');
        config = JSON.parse(content);
        console.log('Loaded config from file');
      } else {
        // Use default config
        config = this.getDefaultConfig();
        console.log('Using default config');
      }
    } catch (error) {
      console.error('Error loading config:', error);
      config = this.getDefaultConfig();
    }
    
    // Apply environment variable overrides
    config = this.applyEnvironmentOverrides(config);
    
    // Validate config
    this.validateConfig(config);
    
    return config;
  }
  
  private getDefaultConfig(): AppConfig {
    return {
      version: '1.0.0',
      environment: 'development',
      features: {
        hotReload: true,
        aiIntegration: true,
        databaseEnabled: true,
        remoteComponents: false
      },
      api: {
        baseUrl: 'http://localhost:3002',
        timeout: 30000,
        retryAttempts: 3
      },
      componentServer: {
        url: 'http://localhost:3001',
        port: 3001,
        fallbackToLocal: true
      },
      ai: {
        provider: 'local',
        maxTokens: 2000
      },
      templates: {
        directory: './src/templates',
        autoReload: true,
        cacheEnabled: true
      },
      rules: {
        enabled: true
      },
      logging: {
        level: 'info'
      }
    };
  }
  
  private applyEnvironmentOverrides(config: AppConfig): AppConfig {
    const overridden = { ...config };
    
    // Apply environment overrides
    if (this.environmentVariables.has('APP_ENV')) {
      overridden.environment = this.environmentVariables.get('APP_ENV') as any;
    }
    
    if (this.environmentVariables.has('API_BASE_URL')) {
      overridden.api.baseUrl = this.environmentVariables.get('API_BASE_URL')!;
    }
    
    if (this.environmentVariables.has('COMPONENT_SERVER_URL')) {
      overridden.componentServer.url = this.environmentVariables.get('COMPONENT_SERVER_URL')!;
    }
    
    if (this.environmentVariables.has('AI_PROVIDER')) {
      overridden.ai.provider = this.environmentVariables.get('AI_PROVIDER') as any;
    }
    
    if (this.environmentVariables.has('AI_API_KEY')) {
      overridden.ai.apiKey = this.environmentVariables.get('AI_API_KEY');
    }
    
    if (this.environmentVariables.has('LOG_LEVEL')) {
      overridden.logging.level = this.environmentVariables.get('LOG_LEVEL') as any;
    }
    
    return overridden;
  }
  
  private validateConfig(config: AppConfig): void {
    const errors: string[] = [];
    
    // Validate required fields
    if (!config.version) {
      errors.push('Config version is required');
    }
    
    if (!config.environment) {
      errors.push('Environment is required');
    }
    
    if (!config.api?.baseUrl) {
      errors.push('API base URL is required');
    }
    
    if (!config.templates?.directory) {
      errors.push('Templates directory is required');
    }
    
    // Validate AI configuration
    if (config.ai.provider !== 'local' && !config.ai.apiKey) {
      errors.push(`API key required for AI provider: ${config.ai.provider}`);
    }
    
    if (errors.length > 0) {
      console.warn('Config validation warnings:', errors);
    }
  }
  
  public enableHotReload(): void {
    if (typeof fs.watch !== 'function') {
      console.warn('File watching not available');
      return;
    }
    
    try {
      const watcher = fs.watch(this.configPath, (eventType) => {
        if (eventType === 'change') {
          console.log('Config file changed, reloading...');
          this.reload();
        }
      });
      
      this.watchers.set('config', watcher);
      console.log('Config hot reload enabled');
    } catch (error) {
      console.error('Error setting up config watcher:', error);
    }
  }
  
  public disableHotReload(): void {
    for (const watcher of this.watchers.values()) {
      watcher.close();
    }
    this.watchers.clear();
    console.log('Config hot reload disabled');
  }
  
  public reload(): void {
    const oldConfig = this.config;
    this.config = this.loadConfig();
    
    // Notify listeners of config change
    for (const listener of this.changeListeners) {
      try {
        listener(this.config);
      } catch (error) {
        console.error('Error in config change listener:', error);
      }
    }
    
    console.log('Config reloaded');
  }
  
  public onChange(listener: (config: AppConfig) => void): () => void {
    this.changeListeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.changeListeners.delete(listener);
    };
  }
  
  public getConfig(): AppConfig {
    return { ...this.config };
  }
  
  public get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config[key];
  }
  
  public getFeature(feature: keyof AppConfig['features']): boolean {
    return this.config.features[feature];
  }
  
  public getApiConfig(): AppConfig['api'] {
    return { ...this.config.api };
  }
  
  public getAIConfig(): AppConfig['ai'] {
    return { ...this.config.ai };
  }
  
  public isProduction(): boolean {
    return this.config.environment === 'production';
  }
  
  public isDevelopment(): boolean {
    return this.config.environment === 'development';
  }
  
  public saveConfig(config: Partial<AppConfig>): void {
    try {
      const merged = { ...this.config, ...config };
      this.validateConfig(merged);
      
      fs.writeFileSync(
        this.configPath,
        JSON.stringify(merged, null, 2),
        'utf-8'
      );
      
      this.config = merged;
      console.log('Config saved successfully');
      
      // Notify listeners
      for (const listener of this.changeListeners) {
        listener(this.config);
      }
    } catch (error) {
      console.error('Error saving config:', error);
      throw error;
    }
  }
  
  public updateFeature(feature: keyof AppConfig['features'], enabled: boolean): void {
    this.config.features[feature] = enabled;
    this.saveConfig(this.config);
  }
}

// Singleton instance
let configLoader: ConfigLoader | null = null;

export function getConfigLoader(configPath?: string): ConfigLoader {
  if (!configLoader) {
    configLoader = new ConfigLoader(configPath);
  }
  return configLoader;
}