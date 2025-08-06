# Security Features Implementation

This document describes the comprehensive security features added to the AI App Generator API server.

## Overview

The API server now includes production-ready security features:

1. **Rate Limiting** - IP-based request limiting with different tiers for authenticated/anonymous users
2. **Authentication** - API key-based authentication with bearer token support
3. **Input Validation** - Request sanitization and validation to prevent injection attacks
4. **Security Headers** - Comprehensive security headers including CORS, CSP, and anti-clickjacking
5. **Enhanced Error Handling** - Secure error responses that don't leak sensitive information

## Rate Limiting

### Configuration
- **Anonymous users**: 10 requests per minute
- **Authenticated users**: 50 requests per minute
- **Cleanup interval**: 5 minutes (removes expired entries)

### Headers
The API returns rate limit information in response headers:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Unix timestamp when the limit resets
- `X-RateLimit-Window`: Window size in seconds

### Usage Example
```bash
curl -i http://localhost:3002/api/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "create a todo app"}'
```

Response includes:
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 9
X-RateLimit-Reset: 1628123456
```

## Authentication

### API Keys
Default demo keys are provided:
- `demo-key-12345` (Basic tier)
- `premium-key-67890` (Premium tier)

### Authentication Methods
The API supports multiple authentication formats:

```bash
# Bearer token format
curl -H "Authorization: Bearer demo-key-12345" \
  http://localhost:3002/api/generate \
  -d '{"prompt": "create a blog app"}'

# API key format
curl -H "Authorization: ApiKey demo-key-12345" \
  http://localhost:3002/api/generate \
  -d '{"prompt": "create a dashboard"}'

# Direct key format
curl -H "Authorization: demo-key-12345" \
  http://localhost:3002/api/generate \
  -d '{"prompt": "create a chat app"}'
```

### Key Management
API keys can be managed through the `AuthMiddleware` class:

```typescript
import { authMiddleware } from './src/middleware/auth';

// Create a new API key
const newKey = authMiddleware.createApiKey('User Name', 'premium');

// Deactivate a key
authMiddleware.deactivateApiKey('some-api-key');

// List all keys (without exposing actual keys)
const keys = authMiddleware.listApiKeys();
```

## Input Validation

### Features
- **Maximum prompt length**: 500 characters
- **Content-Type validation**: Only JSON and plain text allowed
- **Body size limits**: 10KB maximum
- **SQL injection prevention**: Input sanitization
- **XSS protection**: Script tag and JavaScript URI removal
- **Field name validation**: Prevents prototype pollution

### Validation Examples

Valid request:
```json
{
  "prompt": "Create a simple todo application with CRUD operations"
}
```

Invalid request (too long):
```json
{
  "prompt": "Create a todo app with... [500+ characters]"
}
```

Response:
```json
{
  "error": "Request validation failed",
  "code": "VALIDATION_ERROR",
  "details": ["Prompt too long. Maximum length is 500 characters"]
}
```

## Security Headers

The API automatically adds comprehensive security headers:

```http
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
```

## CORS Configuration

CORS is configured to allow specific origins:
- `http://localhost:3000`
- `http://localhost:3001`
- `http://localhost:19006` (Expo dev server)

## Enhanced Error Responses

All error responses follow a consistent, secure format:

```json
{
  "error": "Too many requests. Please try again later.",
  "code": "RATE_LIMIT_EXCEEDED",
  "timestamp": "2024-08-06T12:00:00.000Z"
}
```

Error codes include:
- `RATE_LIMIT_EXCEEDED` (429)
- `UNAUTHORIZED` (401)
- `FORBIDDEN` (403)
- `VALIDATION_ERROR` (400)
- `NOT_FOUND` (404)
- `INTERNAL_ERROR` (500)

## Monitoring and Stats

The `/api/stats` endpoint now includes security metrics:

```json
{
  "apps": 5,
  "dataItems": 23,
  "collections": ["todos", "users"],
  "security": {
    "rateLimitStats": {
      "totalEntries": 15,
      "activeIPs": 8,
      "authenticatedRequests": 45,
      "anonymousRequests": 32
    },
    "timestamp": "2024-08-06T12:00:00.000Z"
  }
}
```

## Production Considerations

For production deployment, consider:

1. **Environment Variables**: Move API keys to environment variables
2. **Database Storage**: Store API keys in encrypted database instead of in-memory
3. **HTTPS**: Enable HTTPS and update security headers accordingly
4. **Logging**: Implement comprehensive security event logging
5. **Monitoring**: Set up alerts for unusual activity patterns
6. **Key Rotation**: Implement automatic API key rotation
7. **IP Whitelisting**: Add IP-based access controls for sensitive endpoints

## Testing Security Features

Test the security features:

```bash
# Test rate limiting (run quickly to trigger limit)
for i in {1..15}; do
  curl -s -o /dev/null -w "%{http_code} " http://localhost:3002/api/generate \
    -H "Content-Type: application/json" \
    -d '{"prompt": "test"}'
done

# Test authentication
curl -H "Authorization: Bearer invalid-key" \
  http://localhost:3002/api/generate \
  -d '{"prompt": "test"}'

# Test input validation
curl -H "Content-Type: application/json" \
  http://localhost:3002/api/generate \
  -d '{"prompt": "'$(head -c 600 < /dev/zero | tr '\0' 'a')'"}'
```

## Implementation Files

The security implementation is organized across these files:

- `/src/config/security-config.ts` - Configuration and constants
- `/src/middleware/rate-limiter.ts` - Rate limiting implementation
- `/src/middleware/auth.ts` - Authentication middleware
- `/src/middleware/validation.ts` - Input validation and sanitization
- `/server/api-server.ts` - Updated server with integrated security

Each middleware component is designed to be modular and can be used independently or together for comprehensive protection.