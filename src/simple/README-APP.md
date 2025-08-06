# Simple Express API Application

A simple, production-ready Express.js API server that integrates all the simple components: authentication, database, AI service, rate limiting, and security.

## Features

- **Authentication**: JWT-based auth with registration/login
- **Database**: SQLite with Bun's built-in SQLite driver
- **AI Integration**: App generation with circuit breaker fallback
- **Rate Limiting**: Multiple tiers (auth, API, AI endpoints)
- **Security**: Helmet.js security headers
- **Error Handling**: Consistent error responses and logging
- **Health Checks**: Basic health endpoint for monitoring

## Quick Start

1. **Setup Environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Start Server**:
   ```bash
   npm run simple-server
   ```

4. **Test API**:
   ```bash
   # Run the demo script
   ./demo-simple-api.sh
   
   # Or test manually
   curl http://localhost:3000/health
   ```

## Environment Variables

### Required
- `JWT_SECRET` - Secret for signing JWT tokens
- `DATABASE_PATH` - Path to SQLite database file

### Optional
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (default: development)
- `AI_PROVIDER` - AI provider: openai|anthropic (default: openai)
- `AI_API_KEY` - API key for AI service
- `AI_MODEL` - Model name (default: gpt-4o-mini)

## API Endpoints

### Public Endpoints
- `GET /health` - Health check

### Authentication
- `POST /auth/register` - User registration
- `POST /auth/login` - User login (returns JWT)

### Protected Endpoints (require JWT)
- `GET /api/apps` - Get user's apps
- `POST /api/generate` - Generate app with AI (strict rate limit)
- `GET /api/apps/:id` - Get specific app (must own)
- `DELETE /api/apps/:id` - Delete app (must own)

## Rate Limits

- **Auth endpoints**: 5 requests per 15 minutes
- **General API**: 100 requests per 15 minutes  
- **AI generation**: 10 requests per 15 minutes

## Example Usage

```bash
# Register user
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "name": "User Name",
    "password": "securepassword"
  }'

# Login to get token
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepassword"
  }'

# Generate app (replace TOKEN with actual JWT)
curl -X POST http://localhost:3000/api/generate \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Create a todo list app"}'
```

## Architecture

### Files
- `app.ts` - Main Express application with all routes and middleware
- `server.ts` - Server startup, configuration, and graceful shutdown
- `database-bun.ts` - SQLite database using Bun's built-in driver
- `auth.ts` - JWT authentication middleware
- `rate-limit.ts` - Rate limiting configurations
- `ai-service.ts` - AI service with circuit breaker
- `config.ts` - Environment configuration

### Database Schema
- `users` - User accounts (id, email, name with embedded password)
- `apps` - Generated apps (id, name, spec, user_id)
- `app_data` - App-specific data (id, app_id, data)

### Security Features
- Helmet.js security headers
- JWT token authentication
- Rate limiting on all endpoints
- Password hashing with crypto.pbkdf2
- Input validation and sanitization
- SQL injection protection (prepared statements)

### AI Integration
- Circuit breaker pattern for AI service resilience
- Fallback templates when AI is unavailable
- Support for OpenAI and Anthropic providers
- Structured response parsing with Zod

## Error Handling

All endpoints return consistent error responses:
```json
{
  "error": "Error description"
}
```

Common status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (invalid/missing token)
- `403` - Forbidden (access denied)
- `404` - Not Found
- `409` - Conflict (resource already exists)
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error
- `503` - Service Unavailable (AI service down)

## Development

The application uses a simple, single-file approach for easy understanding and maintenance:

- All routes are in `app.ts`
- All startup logic is in `server.ts`
- No complex folder structure
- Clear separation of concerns
- Extensive logging and error handling

## Production Considerations

This is a simplified implementation suitable for development and small-scale production use. For larger production deployments, consider:

- Separate password storage from user name field
- Redis for rate limiting storage
- Separate database connection pooling
- More comprehensive logging (structured logs)
- Health checks for external dependencies
- Metrics and monitoring integration
- Load balancer configuration
- Docker containerization