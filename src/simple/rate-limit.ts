import rateLimit from 'express-rate-limit';

/**
 * General API rate limiter: 100 requests per 15 minutes.
 * Uses memory store by default, will use Redis store if available.
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests, please try again later',
    retryAfter: 15 * 60, // 15 minutes in seconds
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

/**
 * Strict rate limiter for AI endpoints: 10 requests per 15 minutes.
 * Used for computationally expensive or AI-powered endpoints.
 */
export const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  message: {
    error: 'Too many AI requests, please try again later',
    retryAfter: 15 * 60, // 15 minutes in seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Very strict rate limiter for authentication endpoints: 5 requests per 15 minutes.
 * Used for login, registration, and password reset endpoints.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    error: 'Too many authentication attempts, please try again later',
    retryAfter: 15 * 60, // 15 minutes in seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Creates a custom rate limiter with specified parameters.
 * 
 * @param max - Maximum number of requests per window
 * @param windowMs - Time window in milliseconds
 * @param message - Custom error message
 */
export function createCustomLimiter(max: number, windowMs: number, message?: string) {
  return rateLimit({
    windowMs,
    max,
    message: {
      error: message || 'Too many requests, please try again later',
      retryAfter: Math.floor(windowMs / 1000),
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
}