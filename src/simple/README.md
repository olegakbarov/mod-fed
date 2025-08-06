# Simple Authentication, Configuration, and AI Service System

A simple, secure system using proven libraries for authentication, configuration, and AI services with circuit breaker protection. This implementation focuses on simplicity and reliability without custom complexity.

## Features

- **Simple Configuration**: Environment variable validation with fail-fast behavior
- **JWT Authentication**: Token creation and verification using the `jsonwebtoken` library
- **Express Middleware**: Ready-to-use authentication middleware
- **Rate Limiting**: Pre-configured rate limiters for different endpoint types
- **Security Headers**: Uses `helmet` for security best practices
- **AI Service with Circuit Breaker**: Reliable AI generation using opossum circuit breaker
- **Smart Fallbacks**: Automatic fallback templates when AI services are unavailable

## Quick Start

1. **Copy environment file**:
   ```bash
   cp .env.simple .env
   ```

2. **Update the JWT secret**:
   ```bash
   # Generate a secure random secret
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```
   
   Update `JWT_SECRET` in your `.env` file with the generated secret.

3. **Use in your Express app**:
   ```typescript
   import express from 'express';
   import helmet from 'helmet';
   import { appConfig, authenticate, apiLimiter } from './src/simple';

   const app = express();

   // Security and rate limiting
   app.use(helmet());
   app.use('/api/', apiLimiter);
   app.use(express.json());

   // Protected routes
   app.use('/api/protected', authenticate);

   // AI generation endpoint
   app.post('/api/generate-app', async (req, res) => {
     try {
       const { prompt } = req.body;
       const appSpec = await generateApp(prompt);
       res.json({ success: true, appSpec });
     } catch (error) {
       res.status(500).json({ success: false, error: error.message });
     }
   });

   app.listen(appConfig.port);
   ```

## Configuration

The system requires these environment variables:

### Required
- `JWT_SECRET`: Secret key for JWT token signing (change in production!)
- `DATABASE_PATH`: Path to the SQLite database file

### Optional
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment (default: development)
- `AI_API_KEY`: OpenAI or Anthropic API key for AI generation
- `AI_PROVIDER`: AI provider ('openai' or 'anthropic', default: 'openai')
- `AI_MODEL`: AI model to use (e.g., 'gpt-4o-mini', 'claude-3-5-sonnet-20241022')

## API Reference

### Configuration (`config.ts`)

```typescript
import { appConfig, jwtSecret, databasePath, port, nodeEnv } from './src/simple/config';
```

- `appConfig`: Complete configuration object
- Individual exports: `jwtSecret`, `databasePath`, `port`, `nodeEnv`

### Authentication (`auth.ts`)

```typescript
import { createToken, verifyToken, authenticate } from './src/simple/auth';

// Create token
const token = createToken('user123', '24h'); // expires in 24 hours

// Verify token
const payload = verifyToken(token); // Returns { userId: string } or null

// Express middleware
app.use('/protected', authenticate);
```

### Rate Limiting (`rate-limit.ts`)

```typescript
import { apiLimiter, strictLimiter, authLimiter, createCustomLimiter } from './src/simple/rate-limit';

// Pre-configured limiters
app.use('/api/', apiLimiter);        // 100 req/15min
app.use('/api/ai/', strictLimiter);  // 10 req/15min  
app.use('/auth/', authLimiter);      // 5 req/15min

// Custom limiter
const customLimiter = createCustomLimiter(50, 10 * 60 * 1000, 'Custom message');
```

### AI Service (`ai-service.ts`)

```typescript
import { generateApp, getAIService } from './src/simple/ai-service';

// Simple usage
const appSpec = await generateApp('Create a todo list app');

// With monitoring
const aiService = getAIService();
const stats = aiService.getStats();
console.log('Circuit state:', stats.isOpen ? 'OPEN' : 'CLOSED');

// Force circuit states (for testing/maintenance)
aiService.forceOpen();
aiService.forceClose();
```

## Rate Limiting Details

| Limiter | Requests | Window | Use Case |
|---------|----------|--------|----------|
| `apiLimiter` | 100 | 15 min | General API endpoints |
| `strictLimiter` | 10 | 15 min | AI/ML endpoints |
| `authLimiter` | 5 | 15 min | Login/registration |

## Security Features

- **JWT tokens**: Secure token-based authentication
- **Rate limiting**: Prevents abuse and DoS attacks
- **Security headers**: Helmet.js for standard security headers
- **Input validation**: Fail-fast configuration validation
- **No custom crypto**: Uses proven libraries only

## Testing

Run the tests:
```bash
npm test -- src/simple/__tests__/
```

## Example Usage

See `example-usage.ts` for a complete Express app example showing how to integrate all components.

## Production Checklist

- [ ] Generate a secure `JWT_SECRET` (64+ random bytes)
- [ ] Set up proper database path and permissions
- [ ] Configure appropriate rate limits for your use case
- [ ] Enable HTTPS in production
- [ ] Set up proper logging and monitoring
- [ ] Consider using Redis for rate limiting in distributed systems

## Dependencies

- `jsonwebtoken`: JWT token handling
- `helmet`: Security headers
- `express-rate-limit`: Rate limiting middleware
- `dotenv`: Environment variable loading
- `express`: Web framework
- `opossum`: Circuit breaker for AI service reliability
- `ai`: AI SDK for OpenAI and Anthropic
- `@ai-sdk/openai`: OpenAI provider
- `@ai-sdk/anthropic`: Anthropic provider
- `zod`: Schema validation for AI responses

## AI Service Features

- **Circuit Breaker**: Uses opossum with proven defaults (10s timeout, 50% error threshold)
- **Smart Fallbacks**: Keyword-based templates for todo, dashboard, blog, and generic apps
- **Error Handling**: Graceful degradation when AI services fail
- **Monitoring**: Built-in statistics and console logging
- **Simple Configuration**: Minimal setup with environment variables

For detailed AI service documentation, see `ai-service-README.md`.