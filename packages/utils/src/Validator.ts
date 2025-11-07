/**
 * Validator - Request and response validation utilities
 */

import { RequestContext, ResponseContext } from '@nginx-js/types';
import { ValidationError } from './ErrorHandler';

export interface ValidationRule<T> {
  name: string;
  validate: (value: T) => boolean;
  message: string;
}

export class Validator<T> {
  private rules: ValidationRule<T>[] = [];

  addRule(rule: ValidationRule<T>): this {
    this.rules.push(rule);
    return this;
  }

  validate(value: T): ValidationResult {
    const errors: string[] = [];

    for (const rule of this.rules) {
      if (!rule.validate(value)) {
        errors.push(`[${rule.name}] ${rule.message}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  validateOrThrow(value: T, context?: RequestContext): void {
    const result = this.validate(value);
    if (!result.valid) {
      throw new ValidationError(`Validation failed: ${result.errors.join(', ')}`, context);
    }
  }
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export class RequestValidator extends Validator<RequestContext> {
  constructor() {
    super();
    this.setupDefaultRules();
  }

  private setupDefaultRules(): void {
    this.addRule({
      name: 'url',
      validate: (context) => {
        return typeof context.url === 'string' && context.url.length > 0;
      },
      message: 'URL must be a non-empty string',
    });

    this.addRule({
      name: 'method',
      validate: (context) => {
        if (!context.method) return true;
        const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
        return validMethods.includes(context.method.toUpperCase());
      },
      message: 'Method must be a valid HTTP method',
    });

    this.addRule({
      name: 'headers',
      validate: (context) => {
        if (!context.headers) return true;
        return typeof context.headers === 'object';
      },
      message: 'Headers must be an object',
    });
  }
}

export class ResponseValidator extends Validator<ResponseContext> {
  constructor() {
    super();
    this.setupDefaultRules();
  }

  private setupDefaultRules(): void {
    // 状态码验证
    this.addRule({
      name: 'status',
      validate: (response) => {
        if (response.status === undefined) return true;
        return response.status >= 100 && response.status < 600;
      },
      message: 'Status code must be between 100 and 599',
    });
  }
}

export class UrlValidator {
  static isValid(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  static hasProtocol(url: string, protocols: string[] = ['http', 'https']): boolean {
    try {
      const urlObj = new URL(url);
      return protocols.includes(urlObj.protocol.replace(':', ''));
    } catch {
      return false;
    }
  }

  static hasDomain(url: string, domains: string[]): boolean {
    try {
      const urlObj = new URL(url);
      return domains.some((domain) => urlObj.hostname.includes(domain));
    } catch {
      return false;
    }
  }

  static hasPath(url: string, paths: string[]): boolean {
    try {
      const urlObj = new URL(url);
      return paths.some((path) => urlObj.pathname.includes(path));
    } catch {
      return false;
    }
  }
}

export class DataValidator {
  static isJSON(str: string): boolean {
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  }

  static hasKeys(obj: any, keys: string[]): boolean {
    if (typeof obj !== 'object' || obj === null) {
      return false;
    }
    return keys.every((key) => key in obj);
  }

  static isArray(value: any): boolean {
    return Array.isArray(value);
  }

  static isNotEmpty(value: any): boolean {
    if (value === null || value === undefined) {
      return false;
    }
    if (typeof value === 'string') {
      return value.trim().length > 0;
    }
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    if (typeof value === 'object') {
      return Object.keys(value).length > 0;
    }
    return true;
  }
}

export function createRule<T>(
  name: string,
  validate: (value: T) => boolean,
  message: string
): ValidationRule<T> {
  return { name, validate, message };
}
