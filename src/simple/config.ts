import { config } from 'dotenv';

// Load environment variables
config();

interface Config {
  jwtSecret: string;
  databasePath: string;
  port: number;
  nodeEnv: string;
}

/**
 * Simple environment variable validation and configuration.
 * Fails fast if required variables are missing.
 * Uses sensible defaults for optional variables.
 */
function loadConfig(): Config {
  const jwtSecret = process.env.JWT_SECRET;
  const databasePath = process.env.DATABASE_PATH;

  // Fail fast if required variables are missing
  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is required');
  }

  if (!databasePath) {
    throw new Error('DATABASE_PATH environment variable is required');
  }

  // Optional variables with defaults
  const port = parseInt(process.env.PORT || '3000', 10);
  const nodeEnv = process.env.NODE_ENV || 'development';

  return {
    jwtSecret,
    databasePath,
    port,
    nodeEnv,
  };
}

// Export singleton config instance
let _appConfig: Config | null = null;

export function getAppConfig(): Config {
  if (!_appConfig) {
    _appConfig = loadConfig();
  }
  return _appConfig;
}

export const appConfig = getAppConfig();

// Export individual config values for convenience
export const { jwtSecret, databasePath, port, nodeEnv } = appConfig;

// Export loadConfig for testing purposes
export { loadConfig };