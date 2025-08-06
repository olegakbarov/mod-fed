# Critical Review - Required Fixes

## 1. Fix Provider Initialization

```typescript
// src/generators/ai-generator.ts
constructor() {
  if (!AI_CONFIG.apiKey) {
    console.warn('No API key configured, will use fallback logic');
    return;
  }

  if (AI_CONFIG.provider === 'anthropic') {
    this.provider = anthropic({
      apiKey: AI_CONFIG.apiKey
    }).chat(AI_CONFIG.model || 'claude-3-5-sonnet-20241022');
  } else {
    this.provider = openai({
      apiKey: AI_CONFIG.apiKey
    }).chat(AI_CONFIG.model || 'gpt-4o-mini');
  }
}
```

## 2. Add Rate Limiting

```typescript
// server/api-server.ts
const rateLimiter = new Map();
const RATE_LIMIT = 10; // requests per minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const minute = 60 * 1000;
  const requests = rateLimiter.get(ip) || [];
  const recentRequests = requests.filter((time: number) => now - time < minute);
  
  if (recentRequests.length >= RATE_LIMIT) {
    return false;
  }
  
  recentRequests.push(now);
  rateLimiter.set(ip, recentRequests);
  return true;
}
```

## 3. Add Input Validation

```typescript
// server/api-server.ts
const MAX_PROMPT_LENGTH = 500;

if (path === "/api/generate" && method === "POST") {
  const body = await parseBody(req);
  
  if (!body || !body.prompt || typeof body.prompt !== 'string') {
    return Response.json({ error: "Invalid prompt" }, { status: 400, headers: corsHeaders });
  }
  
  if (body.prompt.length > MAX_PROMPT_LENGTH) {
    return Response.json({ error: "Prompt too long" }, { status: 400, headers: corsHeaders });
  }
  
  // Sanitize prompt
  const sanitizedPrompt = body.prompt.trim().replace(/[^\w\s.,!?-]/g, '');
  
  // Check rate limit...
}
```

## 4. Add Proper Error Types

```typescript
// src/errors/ai-errors.ts
export class AIGenerationError extends Error {
  constructor(message: string, public code: string, public retryable: boolean) {
    super(message);
    this.name = 'AIGenerationError';
  }
}

export class RateLimitError extends AIGenerationError {
  constructor() {
    super('Rate limit exceeded', 'RATE_LIMIT', false);
  }
}

export class InvalidPromptError extends AIGenerationError {
  constructor(reason: string) {
    super(`Invalid prompt: ${reason}`, 'INVALID_PROMPT', false);
  }
}
```

## 5. Add Retry Logic

```typescript
// src/utils/retry.ts
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
    }
  }
  throw new Error('Max retries exceeded');
}
```

## 6. Add Response Caching

```typescript
// src/cache/generation-cache.ts
const cache = new Map<string, { result: AppSpec; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function getCached(prompt: string): AppSpec | null {
  const cached = cache.get(prompt);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.result;
  }
  return null;
}

export function setCached(prompt: string, result: AppSpec): void {
  cache.set(prompt, { result, timestamp: Date.now() });
}
```

## 7. Add Monitoring

```typescript
// src/monitoring/metrics.ts
export const metrics = {
  generationRequests: 0,
  generationSuccesses: 0,
  generationFailures: 0,
  fallbacksUsed: 0,
  averageResponseTime: 0,
  
  recordGeneration(success: boolean, duration: number, usedFallback: boolean) {
    this.generationRequests++;
    if (success) this.generationSuccesses++;
    else this.generationFailures++;
    if (usedFallback) this.fallbacksUsed++;
    
    // Update average response time
    this.averageResponseTime = 
      (this.averageResponseTime * (this.generationRequests - 1) + duration) / 
      this.generationRequests;
  }
};
```

## 8. Add Proper Tests

```typescript
// src/generators/__tests__/ai-generator.test.ts
import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { AIAppGenerator } from '../ai-generator';

describe('AIAppGenerator', () => {
  let generator: AIAppGenerator;
  
  beforeEach(() => {
    generator = new AIAppGenerator();
  });
  
  it('should use fallback when no API key', async () => {
    const result = await generator.generateApp('create a todo app');
    expect(result.appName).toBe('Todo List App');
  });
  
  it('should handle API errors gracefully', async () => {
    // Mock API failure
    mock.module('ai', () => ({
      generateObject: () => Promise.reject(new Error('API Error'))
    }));
    
    const result = await generator.generateApp('test prompt');
    expect(result).toBeDefined();
  });
});
```

## 9. Security Improvements

- Add API key validation on startup
- Implement request signing/authentication
- Add CORS configuration per environment
- Sanitize all user inputs
- Add request logging with PII redaction

## 10. Production Readiness

- Add health check that verifies AI API connectivity
- Add graceful shutdown handling
- Add environment-specific configurations
- Add structured logging (not console.log)
- Add OpenTelemetry instrumentation