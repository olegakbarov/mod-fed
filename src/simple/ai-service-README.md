# Simple AI Service with Circuit Breaker

A simple, reliable AI service implementation using the proven opossum circuit breaker library.

## Features

- ✅ **Simple Configuration**: Uses opossum defaults with minimal configuration
- ✅ **Automatic Fallbacks**: Smart fallback templates when AI is unavailable
- ✅ **Circuit Breaker Protection**: Prevents cascading failures with opossum
- ✅ **Built-in Monitoring**: Simple console logging and statistics
- ✅ **Error Handling**: Graceful degradation when AI services fail
- ✅ **Template Matching**: Keyword-based fallback to appropriate app templates

## Quick Start

```typescript
import { generateApp, getAIService } from './src/simple/ai-service';

// Simple usage
const appSpec = await generateApp('Create a todo list app');
console.log('Generated:', appSpec.appName);

// With monitoring
const aiService = getAIService();
const stats = aiService.getStats();
console.log('Circuit breaker state:', stats.isOpen ? 'OPEN' : 'CLOSED');
```

## Configuration

The service uses these environment variables:

```env
AI_API_KEY=your-openai-or-anthropic-key
AI_PROVIDER=openai  # or 'anthropic'
AI_MODEL=gpt-4o-mini  # or 'claude-3-5-sonnet-20241022'
```

## Circuit Breaker Configuration

Uses opossum's proven defaults:
- **Timeout**: 10 seconds
- **Error Threshold**: 50% failure rate
- **Reset Timeout**: 30 seconds

## Fallback Templates

When the circuit is open or AI fails, returns appropriate templates:

| Keywords | Template | Database |
|----------|----------|----------|
| todo, task | Todo List App | ✅ |
| dashboard, analytics | Dashboard App | ❌ |
| blog, article | Blog App | ✅ |
| *other* | Generic App | ❌ |

## Express.js Integration

```typescript
import express from 'express';
import { generateApp } from './src/simple/ai-service';

const app = express();
app.use(express.json());

app.post('/generate-app', async (req, res) => {
  try {
    const { prompt } = req.body;
    const appSpec = await generateApp(prompt);
    res.json({ success: true, appSpec });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

## Monitoring

```typescript
import { getAIService } from './src/simple/ai-service';

const aiService = getAIService();

// Get current statistics
const stats = aiService.getStats();
console.log({
  state: stats.isOpen ? 'OPEN' : 'CLOSED',
  totalRequests: stats.fires,
  successes: stats.successes,
  failures: stats.failures,
});

// Force circuit states (for testing/maintenance)
aiService.forceOpen();   // Force circuit open
aiService.forceClose();  // Force circuit closed
```

## Error Handling

The service handles all error scenarios gracefully:

1. **No API Key**: Falls back to templates immediately
2. **API Timeout**: Circuit breaker opens after 10 seconds
3. **High Error Rate**: Circuit opens at 50% failure rate
4. **Network Issues**: Automatic fallback to templates
5. **Invalid Response**: Falls back to templates

## Testing

```bash
# Run tests
npm test -- --testPathPattern="ai-service.test.ts"

# Run demonstration
bun run test-simple-ai.ts
```

## Architecture

```
User Request
     ↓
SimpleAIService
     ↓
Opossum Circuit Breaker
     ↓
AI API Call ───────→ [Success] ───→ Return AI Result
     ↓                               
[Failure/Timeout]
     ↓
Fallback Templates ───→ Return Template Result
```

## Production Considerations

1. **Monitoring**: Set up alerts for circuit breaker state changes
2. **Logging**: Monitor success/failure rates and response times
3. **Fallback Quality**: Ensure templates meet minimum quality standards
4. **API Keys**: Secure storage of API credentials
5. **Rate Limiting**: Consider adding rate limiting for high-traffic scenarios

## Benefits vs Custom Implementation

✅ **Proven Library**: Opossum is battle-tested in production  
✅ **Simple Configuration**: No complex state management  
✅ **Built-in Monitoring**: Statistics and events out of the box  
✅ **Standard Patterns**: Circuit breaker best practices  
✅ **Maintenance**: Less code to maintain and debug  

## Example Output

```
🤖 Simple AI service initialized with circuit breaker
✨ AI generation successful
✅ Generated: Todo List App
📱 Screens: 1
🗄️ Database: enabled

📊 Circuit Breaker Statistics:
  State: 🟢 CLOSED
  Total requests: 1
  Successes: 1
  Failures: 0
```