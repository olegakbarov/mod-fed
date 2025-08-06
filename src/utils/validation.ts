/**
 * Comprehensive validation utilities for AI App Generator
 * 
 * This module provides type-safe validation functions with proper error reporting
 * and integration with the error handling system.
 */

import {
  ValidationError,
  ErrorAggregator,
  PromptValidationError,
  TemplateValidationError,
  ComponentValidationError,
  RuleValidationError,
  ConfigValidationError
} from './errors';

// Type guard utilities
export class TypeGuards {
  static isString(value: unknown): value is string {
    return typeof value === 'string';
  }

  static isNumber(value: unknown): value is number {
    return typeof value === 'number' && !isNaN(value) && isFinite(value);
  }

  static isBoolean(value: unknown): value is boolean {
    return typeof value === 'boolean';
  }

  static isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  static isArray(value: unknown): value is unknown[] {
    return Array.isArray(value);
  }

  static isFunction(value: unknown): value is Function {
    return typeof value === 'function';
  }

  static isNonEmptyString(value: unknown): value is string {
    return this.isString(value) && value.trim().length > 0;
  }

  static isValidUrl(value: unknown): value is string {
    if (!this.isString(value)) return false;
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }

  static isValidId(value: unknown): value is string {
    return this.isString(value) && /^[a-zA-Z0-9_-]+$/.test(value) && value.length > 0;
  }

  static isValidEmail(value: unknown): value is string {
    if (!this.isString(value)) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  static isPositiveNumber(value: unknown): value is number {
    return this.isNumber(value) && value > 0;
  }

  static isNonNegativeNumber(value: unknown): value is number {
    return this.isNumber(value) && value >= 0;
  }

  static isIntegerInRange(value: unknown, min: number, max: number): value is number {
    return this.isNumber(value) && Number.isInteger(value) && value >= min && value <= max;
  }

  static hasProperty<T extends string>(
    obj: unknown,
    prop: T
  ): obj is Record<T, unknown> {
    return this.isObject(obj) && prop in obj;
  }

  static hasRequiredProperties<T extends string>(
    obj: unknown,
    props: readonly T[]
  ): obj is Record<T, unknown> {
    if (!this.isObject(obj)) return false;
    return props.every(prop => prop in obj);
  }
}

// Validation result type
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

// Base validator class
export abstract class BaseValidator<T> {
  protected errors: string[] = [];
  protected warnings: string[] = [];

  abstract validate(value: T): ValidationResult;

  protected addError(message: string): void {
    this.errors.push(message);
  }

  protected addWarning(message: string): void {
    this.warnings.push(message);
  }

  protected reset(): void {
    this.errors = [];
    this.warnings = [];
  }

  protected createResult(): ValidationResult {
    const result: ValidationResult = {
      valid: this.errors.length === 0,
      errors: [...this.errors]
    };

    if (this.warnings.length > 0) {
      result.warnings = [...this.warnings];
    }

    return result;
  }
}

// String validation utilities
export class StringValidator extends BaseValidator<string> {
  private minLength?: number;
  private maxLength?: number;
  private pattern?: RegExp;
  private allowEmpty: boolean = false;
  private customValidators: Array<(value: string) => string | null> = [];

  static create(): StringValidator {
    return new StringValidator();
  }

  min(length: number): StringValidator {
    this.minLength = length;
    return this;
  }

  max(length: number): StringValidator {
    this.maxLength = length;
    return this;
  }

  length(min: number, max: number): StringValidator {
    this.minLength = min;
    this.maxLength = max;
    return this;
  }

  matches(pattern: RegExp, errorMessage?: string): StringValidator {
    this.pattern = pattern;
    this.customValidators.push((value) => {
      return pattern.test(value) ? null : (errorMessage || `Must match pattern ${pattern}`);
    });
    return this;
  }

  empty(allowed: boolean = true): StringValidator {
    this.allowEmpty = allowed;
    return this;
  }

  custom(validator: (value: string) => string | null): StringValidator {
    this.customValidators.push(validator);
    return this;
  }

  email(): StringValidator {
    return this.custom((value) => {
      return TypeGuards.isValidEmail(value) ? null : 'Must be a valid email address';
    });
  }

  url(): StringValidator {
    return this.custom((value) => {
      return TypeGuards.isValidUrl(value) ? null : 'Must be a valid URL';
    });
  }

  id(): StringValidator {
    return this.custom((value) => {
      return TypeGuards.isValidId(value) ? null : 'Must be a valid ID (alphanumeric, _, -)';
    });
  }

  validate(value: string): ValidationResult {
    this.reset();

    if (!TypeGuards.isString(value)) {
      this.addError('Must be a string');
      return this.createResult();
    }

    const trimmed = value.trim();

    if (!this.allowEmpty && trimmed.length === 0) {
      this.addError('Cannot be empty');
    }

    if (this.minLength !== undefined && value.length < this.minLength) {
      this.addError(`Must be at least ${this.minLength} characters long`);
    }

    if (this.maxLength !== undefined && value.length > this.maxLength) {
      this.addError(`Must be no more than ${this.maxLength} characters long`);
    }

    // Run custom validators
    for (const validator of this.customValidators) {
      const error = validator(value);
      if (error) {
        this.addError(error);
      }
    }

    return this.createResult();
  }
}

// Number validation utilities
export class NumberValidator extends BaseValidator<number> {
  private min?: number;
  private max?: number;
  private integer: boolean = false;
  private positive: boolean = false;
  private nonNegative: boolean = false;

  static create(): NumberValidator {
    return new NumberValidator();
  }

  minimum(value: number): NumberValidator {
    this.min = value;
    return this;
  }

  maximum(value: number): NumberValidator {
    this.max = value;
    return this;
  }

  range(min: number, max: number): NumberValidator {
    this.min = min;
    this.max = max;
    return this;
  }

  int(): NumberValidator {
    this.integer = true;
    return this;
  }

  pos(): NumberValidator {
    this.positive = true;
    return this;
  }

  nonNeg(): NumberValidator {
    this.nonNegative = true;
    return this;
  }

  validate(value: number): ValidationResult {
    this.reset();

    if (!TypeGuards.isNumber(value)) {
      this.addError('Must be a valid number');
      return this.createResult();
    }

    if (this.integer && !Number.isInteger(value)) {
      this.addError('Must be an integer');
    }

    if (this.positive && value <= 0) {
      this.addError('Must be positive');
    }

    if (this.nonNegative && value < 0) {
      this.addError('Must be non-negative');
    }

    if (this.min !== undefined && value < this.min) {
      this.addError(`Must be at least ${this.min}`);
    }

    if (this.max !== undefined && value > this.max) {
      this.addError(`Must be at most ${this.max}`);
    }

    return this.createResult();
  }
}

// Object validation utilities
export class ObjectValidator extends BaseValidator<Record<string, unknown>> {
  private requiredFields: string[] = [];
  private fieldValidators: Map<string, (value: unknown) => ValidationResult> = new Map();
  private customValidators: Array<(obj: Record<string, unknown>) => string | null> = [];

  static create(): ObjectValidator {
    return new ObjectValidator();
  }

  required(...fields: string[]): ObjectValidator {
    this.requiredFields.push(...fields);
    return this;
  }

  field(name: string, validator: (value: unknown) => ValidationResult): ObjectValidator {
    this.fieldValidators.set(name, validator);
    return this;
  }

  custom(validator: (obj: Record<string, unknown>) => string | null): ObjectValidator {
    this.customValidators.push(validator);
    return this;
  }

  validate(value: Record<string, unknown>): ValidationResult {
    this.reset();

    if (!TypeGuards.isObject(value)) {
      this.addError('Must be an object');
      return this.createResult();
    }

    // Check required fields
    for (const field of this.requiredFields) {
      if (!(field in value) || value[field] == null) {
        this.addError(`Missing required field: ${field}`);
      }
    }

    // Validate individual fields
    for (const [fieldName, validator] of this.fieldValidators) {
      if (fieldName in value) {
        const fieldResult = validator(value[fieldName]);
        if (!fieldResult.valid) {
          for (const error of fieldResult.errors) {
            this.addError(`${fieldName}: ${error}`);
          }
        }
      }
    }

    // Run custom validators
    for (const validator of this.customValidators) {
      const error = validator(value);
      if (error) {
        this.addError(error);
      }
    }

    return this.createResult();
  }
}

// Array validation utilities
export class ArrayValidator extends BaseValidator<unknown[]> {
  private minLength?: number;
  private maxLength?: number;
  private itemValidator?: (item: unknown, index: number) => ValidationResult;

  static create(): ArrayValidator {
    return new ArrayValidator();
  }

  min(length: number): ArrayValidator {
    this.minLength = length;
    return this;
  }

  max(length: number): ArrayValidator {
    this.maxLength = length;
    return this;
  }

  length(min: number, max: number): ArrayValidator {
    this.minLength = min;
    this.maxLength = max;
    return this;
  }

  items(validator: (item: unknown, index: number) => ValidationResult): ArrayValidator {
    this.itemValidator = validator;
    return this;
  }

  validate(value: unknown[]): ValidationResult {
    this.reset();

    if (!TypeGuards.isArray(value)) {
      this.addError('Must be an array');
      return this.createResult();
    }

    if (this.minLength !== undefined && value.length < this.minLength) {
      this.addError(`Must have at least ${this.minLength} items`);
    }

    if (this.maxLength !== undefined && value.length > this.maxLength) {
      this.addError(`Must have at most ${this.maxLength} items`);
    }

    // Validate items
    if (this.itemValidator) {
      value.forEach((item, index) => {
        const itemResult = this.itemValidator!(item, index);
        if (!itemResult.valid) {
          for (const error of itemResult.errors) {
            this.addError(`Item ${index}: ${error}`);
          }
        }
      });
    }

    return this.createResult();
  }
}

// Domain-specific validators
export class PromptValidator {
  static validate(prompt: string): ValidationResult {
    const validator = StringValidator.create()
      .min(1)
      .max(5000)
      .custom((value) => {
        if (value.trim().length === 0) {
          return 'Prompt cannot be empty or only whitespace';
        }
        return null;
      })
      .custom((value) => {
        // Check for potentially problematic content
        const suspicious = ['<script', 'javascript:', 'eval(', 'function('];
        if (suspicious.some(pattern => value.toLowerCase().includes(pattern))) {
          return 'Prompt contains potentially unsafe content';
        }
        return null;
      });

    const result = validator.validate(prompt);
    
    if (!result.valid) {
      throw new PromptValidationError(prompt, result.errors);
    }

    return result;
  }
}

export class TemplateValidator {
  static validate(template: any): ValidationResult {
    const aggregator = new ErrorAggregator();

    try {
      // Validate template structure
      const templateValidator = ObjectValidator.create()
        .required('id', 'name', 'description', 'keywords', 'aiTags', 'variables', 'screens', 'metadata')
        .field('id', (value) => StringValidator.create().id().validate(value as string))
        .field('name', (value) => StringValidator.create().min(1).max(100).validate(value as string))
        .field('description', (value) => StringValidator.create().min(1).max(500).validate(value as string))
        .field('keywords', (value) => {
          return ArrayValidator.create()
            .min(1)
            .items((item) => StringValidator.create().min(1).validate(item as string))
            .validate(value as unknown[]);
        })
        .field('aiTags', (value) => {
          return ArrayValidator.create()
            .min(1)
            .items((item) => StringValidator.create().min(1).validate(item as string))
            .validate(value as unknown[]);
        })
        .field('screens', (value) => {
          return ArrayValidator.create()
            .min(1)
            .items((screen) => this.validateScreen(screen))
            .validate(value as unknown[]);
        });

      const result = templateValidator.validate(template);
      if (!result.valid) {
        throw new TemplateValidationError(template.id || 'unknown', result.errors);
      }

      return result;
    } catch (error) {
      if (error instanceof TemplateValidationError) {
        throw error;
      }
      throw new TemplateValidationError(
        template?.id || 'unknown',
        [`Validation error: ${(error as Error).message}`]
      );
    }
  }

  private static validateScreen(screen: unknown): ValidationResult {
    return ObjectValidator.create()
      .required('name', 'title', 'layout', 'components')
      .field('name', (value) => StringValidator.create().id().validate(value as string))
      .field('title', (value) => StringValidator.create().min(1).max(100).validate(value as string))
      .field('layout', (value) => {
        const validLayouts = ['vertical', 'horizontal', 'grid'];
        return StringValidator.create()
          .custom((val) => validLayouts.includes(val) ? null : `Layout must be one of: ${validLayouts.join(', ')}`)
          .validate(value as string);
      })
      .field('components', (value) => {
        return ArrayValidator.create()
          .min(1)
          .items((component) => this.validateComponent(component))
          .validate(value as unknown[]);
      })
      .validate(screen as Record<string, unknown>);
  }

  private static validateComponent(component: unknown): ValidationResult {
    return ObjectValidator.create()
      .required('type', 'props')
      .field('type', (value) => StringValidator.create().min(1).validate(value as string))
      .field('order', (value) => {
        if (value !== undefined) {
          return NumberValidator.create().nonNeg().int().validate(value as number);
        }
        return { valid: true, errors: [] };
      })
      .validate(component as Record<string, unknown>);
  }
}

export class ComponentValidator {
  static validate(component: any): ValidationResult {
    try {
      const validator = ObjectValidator.create()
        .required('id', 'name', 'type', 'description', 'category', 'aiTags')
        .field('id', (value) => StringValidator.create().id().validate(value as string))
        .field('name', (value) => StringValidator.create().min(1).max(100).validate(value as string))
        .field('type', (value) => StringValidator.create().min(1).validate(value as string))
        .field('description', (value) => StringValidator.create().min(1).max(500).validate(value as string))
        .field('category', (value) => StringValidator.create().min(1).validate(value as string))
        .field('aiTags', (value) => {
          return ArrayValidator.create()
            .min(1)
            .items((item) => StringValidator.create().min(1).validate(item as string))
            .validate(value as unknown[]);
        })
        .field('props', (value) => {
          if (value !== undefined) {
            return ObjectValidator.create().validate(value as Record<string, unknown>);
          }
          return { valid: true, errors: [] };
        });

      const result = validator.validate(component);
      if (!result.valid) {
        throw new ComponentValidationError(component.type || 'unknown', result.errors);
      }

      return result;
    } catch (error) {
      if (error instanceof ComponentValidationError) {
        throw error;
      }
      throw new ComponentValidationError(
        component?.type || 'unknown',
        [`Validation error: ${(error as Error).message}`]
      );
    }
  }
}

export class ConfigValidator {
  static validate(config: any): ValidationResult {
    try {
      const validator = ObjectValidator.create()
        .required('version', 'environment', 'features', 'api', 'componentServer', 'ai', 'templates', 'rules', 'logging')
        .field('version', (value) => StringValidator.create().min(1).validate(value as string))
        .field('environment', (value) => {
          const validEnvs = ['development', 'staging', 'production'];
          return StringValidator.create()
            .custom((val) => validEnvs.includes(val) ? null : `Environment must be one of: ${validEnvs.join(', ')}`)
            .validate(value as string);
        })
        .field('api', (value) => this.validateApiConfig(value))
        .field('ai', (value) => this.validateAiConfig(value))
        .field('logging', (value) => this.validateLoggingConfig(value));

      const result = validator.validate(config);
      if (!result.valid) {
        throw new ConfigValidationError(result.errors);
      }

      return result;
    } catch (error) {
      if (error instanceof ConfigValidationError) {
        throw error;
      }
      throw new ConfigValidationError([`Validation error: ${(error as Error).message}`]);
    }
  }

  private static validateApiConfig(api: unknown): ValidationResult {
    return ObjectValidator.create()
      .required('baseUrl', 'timeout', 'retryAttempts')
      .field('baseUrl', (value) => StringValidator.create().url().validate(value as string))
      .field('timeout', (value) => NumberValidator.create().pos().int().validate(value as number))
      .field('retryAttempts', (value) => NumberValidator.create().nonNeg().int().range(0, 10).validate(value as number))
      .validate(api as Record<string, unknown>);
  }

  private static validateAiConfig(ai: unknown): ValidationResult {
    return ObjectValidator.create()
      .required('provider')
      .field('provider', (value) => {
        const validProviders = ['openai', 'claude', 'local'];
        return StringValidator.create()
          .custom((val) => validProviders.includes(val) ? null : `AI provider must be one of: ${validProviders.join(', ')}`)
          .validate(value as string);
      })
      .field('maxTokens', (value) => {
        if (value !== undefined) {
          return NumberValidator.create().pos().int().range(1, 10000).validate(value as number);
        }
        return { valid: true, errors: [] };
      })
      .validate(ai as Record<string, unknown>);
  }

  private static validateLoggingConfig(logging: unknown): ValidationResult {
    return ObjectValidator.create()
      .required('level')
      .field('level', (value) => {
        const validLevels = ['debug', 'info', 'warn', 'error'];
        return StringValidator.create()
          .custom((val) => validLevels.includes(val) ? null : `Log level must be one of: ${validLevels.join(', ')}`)
          .validate(value as string);
      })
      .validate(logging as Record<string, unknown>);
  }
}

// Utility functions for common validation patterns
export const Validators = {
  string: () => StringValidator.create(),
  number: () => NumberValidator.create(),
  object: () => ObjectValidator.create(),
  array: () => ArrayValidator.create(),
  
  // Common patterns
  required: <T>(value: T | null | undefined, name: string): T => {
    if (value == null) {
      throw new ValidationError(name, value, [`${name} is required`]);
    }
    return value;
  },

  nonEmpty: (value: string, name: string): string => {
    if (!TypeGuards.isNonEmptyString(value)) {
      throw new ValidationError(name, value, [`${name} cannot be empty`]);
    }
    return value;
  },

  positive: (value: number, name: string): number => {
    if (!TypeGuards.isPositiveNumber(value)) {
      throw new ValidationError(name, value, [`${name} must be positive`]);
    }
    return value;
  },

  oneOf: <T>(value: T, options: readonly T[], name: string): T => {
    if (!options.includes(value)) {
      throw new ValidationError(name, value, [`${name} must be one of: ${options.join(', ')}`]);
    }
    return value;
  },

  // Batch validation
  validateAll: (validators: Array<() => void>): void => {
    const aggregator = new ErrorAggregator();
    
    for (const validator of validators) {
      try {
        validator();
      } catch (error) {
        if (error instanceof ValidationError) {
          aggregator.add(error);
        } else {
          aggregator.add(new ValidationError('unknown', 'unknown', [(error as Error).message]));
        }
      }
    }

    aggregator.throwIfCritical();
  }
};