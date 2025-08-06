/**
 * Centralized secret management for the AI App Generator
 * This module handles loading and validating environment variables and secrets
 */

export interface SecretsConfig {
  apiKeys: {
    openai?: string;
    anthropic?: string;
    custom?: Record<string, string>;
  };
  database: {
    url?: string;
    password?: string;
  };
  server: {
    jwtSecret?: string;
    encryptionKey?: string;
  };
  security: {
    trustedProxies: string[];
    corsOrigins: string[];
  };
}

class SecretsManager {
  private secrets: SecretsConfig | null = null;
  private requiredSecrets = [
    'SERVER_JWT_SECRET',
    'SERVER_ENCRYPTION_KEY'
  ];

  /**
   * Initialize secrets from environment variables
   * Validates that all required secrets are present
   */
  initialize(): SecretsConfig {
    if (this.secrets) {
      return this.secrets;
    }

    // Validate required secrets are present
    const missingSecrets = this.requiredSecrets.filter(
      secret => !process.env[secret] || process.env[secret]?.trim() === ''
    );

    if (missingSecrets.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missingSecrets.join(', ')}. ` +
        'Please check your .env file or environment configuration.'
      );
    }

    // Load secrets from environment
    this.secrets = {
      apiKeys: {
        openai: process.env.OPENAI_API_KEY?.trim(),
        anthropic: process.env.ANTHROPIC_API_KEY?.trim(),
        custom: this.loadCustomApiKeys(),
      },
      database: {
        url: process.env.DATABASE_URL?.trim(),
        password: process.env.DATABASE_PASSWORD?.trim(),
      },
      server: {
        jwtSecret: process.env.SERVER_JWT_SECRET?.trim(),
        encryptionKey: process.env.SERVER_ENCRYPTION_KEY?.trim(),
      },
      security: {
        trustedProxies: this.parseStringArray(process.env.TRUSTED_PROXIES),
        corsOrigins: this.parseStringArray(process.env.CORS_ORIGINS),
      },
    };

    // Validate secret formats
    this.validateSecrets(this.secrets);

    return this.secrets;
  }

  /**
   * Get a specific secret
   */
  getSecret(path: string): string | undefined {
    const secrets = this.getSecrets();
    const parts = path.split('.');
    let current: any = secrets;

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return undefined;
      }
    }

    return typeof current === 'string' ? current : undefined;
  }

  /**
   * Get all secrets (for internal use only)
   */
  getSecrets(): SecretsConfig {
    if (!this.secrets) {
      return this.initialize();
    }
    return this.secrets;
  }

  /**
   * Check if a secret exists and is not empty
   */
  hasSecret(path: string): boolean {
    const secret = this.getSecret(path);
    return secret !== undefined && secret.trim() !== '';
  }

  /**
   * Load custom API keys from environment variables
   * Looks for variables matching CUSTOM_API_KEY_*
   */
  private loadCustomApiKeys(): Record<string, string> {
    const customKeys: Record<string, string> = {};
    const prefix = 'CUSTOM_API_KEY_';

    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith(prefix) && value?.trim()) {
        const keyName = key.substring(prefix.length).toLowerCase();
        customKeys[keyName] = value.trim();
      }
    }

    return customKeys;
  }

  /**
   * Parse comma-separated string arrays from environment variables
   */
  private parseStringArray(envVar?: string): string[] {
    if (!envVar?.trim()) {
      return [];
    }

    return envVar
      .split(',')
      .map(item => item.trim())
      .filter(item => item.length > 0);
  }

  /**
   * Validate secret formats and requirements
   */
  private validateSecrets(secrets: SecretsConfig): void {
    // Validate JWT secret length
    if (secrets.server.jwtSecret && secrets.server.jwtSecret.length < 32) {
      throw new Error('SERVER_JWT_SECRET must be at least 32 characters long');
    }

    // Validate encryption key length
    if (secrets.server.encryptionKey && secrets.server.encryptionKey.length < 32) {
      throw new Error('SERVER_ENCRYPTION_KEY must be at least 32 characters long');
    }

    // Validate trusted proxy IPs
    for (const proxy of secrets.security.trustedProxies) {
      if (!this.isValidIPOrCIDR(proxy)) {
        throw new Error(`Invalid trusted proxy IP/CIDR: ${proxy}`);
      }
    }

    // Validate CORS origins
    for (const origin of secrets.security.corsOrigins) {
      if (!this.isValidOrigin(origin)) {
        throw new Error(`Invalid CORS origin: ${origin}`);
      }
    }
  }

  /**
   * Validate IP address or CIDR notation
   */
  private isValidIPOrCIDR(ip: string): boolean {
    // Basic IP/CIDR validation - in production, use a proper IP validation library
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
    const localhostRegex = /^(localhost|127\.0\.0\.1)$/;
    
    if (localhostRegex.test(ip)) return true;
    
    if (!ipRegex.test(ip)) return false;
    
    // Validate IP parts are in valid range
    const parts = ip.split('/')[0].split('.');
    return parts.every(part => {
      const num = parseInt(part, 10);
      return num >= 0 && num <= 255;
    });
  }

  /**
   * Validate CORS origin format
   */
  private isValidOrigin(origin: string): boolean {
    if (origin === '*') return true;
    
    try {
      new URL(origin);
      return true;
    } catch {
      // Check for localhost patterns
      return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    }
  }

  /**
   * Create a safe error message that doesn't expose secret values
   */
  createSafeErrorMessage(error: Error): string {
    const message = error.message;
    
    // Remove any potential secret values from error messages
    return message
      .replace(/=[^,\s]+/g, '=***') // Replace env var values
      .replace(/:\s*[^,\s]+/g, ': ***') // Replace JSON-like values
      .replace(/['"][^'"]+['"]/g, '***'); // Replace quoted strings
  }
}

// Export singleton instance
export const secretsManager = new SecretsManager();

// Convenience functions for common operations
export const getSecret = (path: string) => secretsManager.getSecret(path);
export const hasSecret = (path: string) => secretsManager.hasSecret(path);
export const initializeSecrets = () => secretsManager.initialize();