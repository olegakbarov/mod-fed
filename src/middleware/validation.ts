import { defaultSecurityConfig, secureErrorMessages } from '../config/security-config';

export interface ValidationResult {
  isValid: boolean;
  data?: any;
  errors?: string[];
  sanitizedData?: any;
}

export interface ValidationOptions {
  maxLength?: number;
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array';
  sanitize?: boolean;
  allowedFields?: string[];
}

export class ValidationMiddleware {
  constructor(private config = defaultSecurityConfig.validation) {}

  /**
   * Validate and sanitize request body
   */
  async validateRequestBody(req: Request): Promise<ValidationResult> {
    // Check content type
    const contentType = req.headers.get('content-type') || '';
    if (!this.isAllowedContentType(contentType)) {
      return {
        isValid: false,
        errors: ['Unsupported content type'],
      };
    }

    // Check content length
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > this.config.maxBodySizeBytes) {
      return {
        isValid: false,
        errors: ['Request body too large'],
      };
    }

    try {
      const body = await req.text();
      
      // Validate body size after reading
      if (body.length > this.config.maxBodySizeBytes) {
        return {
          isValid: false,
          errors: ['Request body too large'],
        };
      }

      // Parse JSON if content type is JSON
      let parsedBody;
      if (contentType.includes('application/json')) {
        try {
          parsedBody = JSON.parse(body);
        } catch (error) {
          return {
            isValid: false,
            errors: ['Invalid JSON format'],
          };
        }
      } else {
        parsedBody = body;
      }

      return {
        isValid: true,
        data: parsedBody,
        sanitizedData: this.sanitizeData(parsedBody),
      };
    } catch (error) {
      return {
        isValid: false,
        errors: ['Failed to read request body'],
      };
    }
  }

  /**
   * Validate the /api/generate endpoint payload
   */
  validateGenerateRequest(data: any): ValidationResult {
    const errors: string[] = [];
    const sanitized: any = {};

    // Validate prompt
    if (!data || typeof data !== 'object') {
      return {
        isValid: false,
        errors: ['Request body must be a valid object'],
      };
    }

    if (!data.prompt) {
      errors.push('Missing required field: prompt');
    } else if (typeof data.prompt !== 'string') {
      errors.push('Prompt must be a string');
    } else if (data.prompt.length > this.config.maxPromptLength) {
      errors.push(`Prompt too long. Maximum length is ${this.config.maxPromptLength} characters`);
    } else if (data.prompt.trim().length === 0) {
      errors.push('Prompt cannot be empty');
    } else {
      sanitized.prompt = this.sanitizeString(data.prompt);
    }

    // Optional fields validation
    if (data.options && typeof data.options === 'object') {
      sanitized.options = this.sanitizeObject(data.options, {
        template: 'string',
        theme: 'string',
        complexity: 'string',
      });
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      sanitizedData: sanitized,
    };
  }

  /**
   * Validate dynamic data endpoint payloads
   */
  validateDataRequest(data: any, collection: string): ValidationResult {
    const errors: string[] = [];
    const sanitized: any = {};

    if (!data || typeof data !== 'object') {
      return {
        isValid: false,
        errors: ['Request body must be a valid object'],
      };
    }

    // Validate collection name
    if (!this.isValidCollectionName(collection)) {
      errors.push('Invalid collection name');
    }

    // Basic sanitization of data fields
    for (const [key, value] of Object.entries(data)) {
      if (this.isValidFieldName(key)) {
        sanitized[key] = this.sanitizeValue(value);
      } else {
        errors.push(`Invalid field name: ${key}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      sanitizedData: sanitized,
    };
  }

  /**
   * Sanitize a string to prevent injection attacks
   */
  private sanitizeString(input: string): string {
    if (typeof input !== 'string') return '';
    
    return input
      .trim()
      // Remove null bytes
      .replace(/\0/g, '')
      // Remove control characters except newlines and tabs
      .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
      // Limit consecutive whitespace
      .replace(/\s{4,}/g, '   ')
      // Remove potentially dangerous patterns
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/vbscript:/gi, '')
      .replace(/on\w+\s*=/gi, '');
  }

  /**
   * Sanitize any value based on its type
   */
  private sanitizeValue(value: any): any {
    if (typeof value === 'string') {
      return this.sanitizeString(value);
    } else if (typeof value === 'number') {
      // Ensure it's a safe number
      return isFinite(value) ? value : 0;
    } else if (typeof value === 'boolean') {
      return Boolean(value);
    } else if (Array.isArray(value)) {
      return value.slice(0, 100).map(item => this.sanitizeValue(item)); // Limit array size
    } else if (value && typeof value === 'object') {
      return this.sanitizeObject(value);
    }
    return null;
  }

  /**
   * Sanitize an object recursively
   */
  private sanitizeObject(obj: any, allowedFields?: Record<string, string>): any {
    if (!obj || typeof obj !== 'object') return {};
    
    const sanitized: any = {};
    const entries = Object.entries(obj).slice(0, 50); // Limit object size
    
    for (const [key, value] of entries) {
      if (this.isValidFieldName(key)) {
        if (allowedFields && !allowedFields[key]) continue;
        
        const expectedType = allowedFields?.[key];
        if (expectedType && typeof value !== expectedType) continue;
        
        sanitized[key] = this.sanitizeValue(value);
      }
    }
    
    return sanitized;
  }

  /**
   * Sanitize data structure
   */
  private sanitizeData(data: any): any {
    if (data === null || data === undefined) return data;
    return this.sanitizeValue(data);
  }

  /**
   * Check if content type is allowed
   */
  private isAllowedContentType(contentType: string): boolean {
    const cleanContentType = contentType.toLowerCase().split(';')[0].trim();
    return this.config.allowedContentTypes.some(allowed => 
      cleanContentType.includes(allowed.toLowerCase())
    );
  }

  /**
   * Validate collection names for dynamic data endpoints
   */
  private isValidCollectionName(collection: string): boolean {
    if (!collection || typeof collection !== 'string') return false;
    
    // Allow alphanumeric characters, hyphens, and underscores
    const validPattern = /^[a-zA-Z0-9_-]+$/;
    return validPattern.test(collection) && collection.length <= 50;
  }

  /**
   * Validate field names
   */
  private isValidFieldName(fieldName: string): boolean {
    if (!fieldName || typeof fieldName !== 'string') return false;
    
    // Prevent dangerous field names
    const dangerousFields = [
      '__proto__',
      'constructor',
      'prototype',
      'eval',
      'function',
      'script',
    ];
    
    if (dangerousFields.includes(fieldName.toLowerCase())) return false;
    
    // Allow reasonable field names
    const validPattern = /^[a-zA-Z_][a-zA-Z0-9_-]*$/;
    return validPattern.test(fieldName) && fieldName.length <= 100;
  }
}

/**
 * Create a validation error response
 */
export function createValidationErrorResponse(errors: string[], headers: Record<string, string> = {}): Response {
  return new Response(
    JSON.stringify({
      error: secureErrorMessages.VALIDATION_ERROR,
      code: 'VALIDATION_ERROR',
      details: errors,
    }),
    {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    }
  );
}

/**
 * Create a request too large response
 */
export function createRequestTooLargeResponse(headers: Record<string, string> = {}): Response {
  return new Response(
    JSON.stringify({
      error: 'Request entity too large',
      code: 'REQUEST_TOO_LARGE',
    }),
    {
      status: 413,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    }
  );
}

// Create a singleton instance for use across the application
export const validationMiddleware = new ValidationMiddleware();