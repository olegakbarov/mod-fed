/**
 * Simple Authentication, Configuration, and AI Service System
 * 
 * This module provides a simple, secure system using proven libraries:
 * 
 * - Environment variable validation with fail-fast behavior
 * - JWT token creation and verification
 * - Express authentication middleware
 * - Rate limiting for different endpoint types
 * - AI service with opossum circuit breaker
 * 
 * Usage:
 * ```typescript
 * import { appConfig, createToken, authenticate, apiLimiter, generateApp } from './simple';
 * 
 * // Use in Express app
 * app.use(helmet());
 * app.use(apiLimiter);
 * app.use('/api/protected', authenticate);
 * 
 * // Generate apps with circuit breaker protection
 * const appSpec = await generateApp('Create a todo list app');
 * ```
 */

export * from './config';
export * from './auth';
export * from './rate-limit';
export * from './ai-service';