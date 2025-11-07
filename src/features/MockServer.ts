/**
 * MockServer - Mock.js-like data mocking and proxying functionality
 */

import { RequestContext, ResponseContext } from '../types';
import { createLogger } from '../utils/Logger';

const logger = createLogger('MockServer');

export interface MockRule {
  name: string;
  pattern: string | RegExp;
  method?: string | string[];
  response: any | ((context: RequestContext) => any | Promise<any>);
  delay?: number;
  status?: number;
  headers?: Record<string, string>;
  enabled?: boolean;
  condition?: (context: RequestContext) => boolean;
}

export class MockServer {
  private rules: MockRule[] = [];
  private enabled = true;

  addRule(rule: MockRule): this {
    this.rules.push({
      enabled: true,
      status: 200,
      delay: 0,
      headers: {
        'content-type': 'application/json',
      },
      ...rule,
    });
    
    logger.debug(`Mock rule added: ${rule.name}`);
    return this;
  }

  addRules(rules: MockRule[]): this {
    rules.forEach(rule => this.addRule(rule));
    return this;
  }

  removeRule(name: string): this {
    this.rules = this.rules.filter(rule => rule.name !== name);
    logger.debug(`Mock rule removed: ${name}`);
    return this;
  }

  enableRule(name: string): this {
    const rule = this.rules.find(r => r.name === name);
    if (rule) {
      rule.enabled = true;
      logger.debug(`Mock rule enabled: ${name}`);
    }
    return this;
  }

  disableRule(name: string): this {
    const rule = this.rules.find(r => r.name === name);
    if (rule) {
      rule.enabled = false;
      logger.debug(`Mock rule disabled: ${name}`);
    }
    return this;
  }

  enable(): this {
    this.enabled = true;
    logger.info('Mock server enabled');
    return this;
  }

  disable(): this {
    this.enabled = false;
    logger.info('Mock server disabled');
    return this;
  }

  async match(context: RequestContext): Promise<ResponseContext | null> {
    if (!this.enabled) {
      return null;
    }

    for (const rule of this.rules) {
      if (!rule.enabled) {
        continue;
      }

      if (rule.condition && !rule.condition(context)) {
        continue;
      }

      if (!this._matchPattern(context.url, rule.pattern)) {
        continue;
      }

      if (rule.method && !this._matchMethod(context.method, rule.method)) {
        continue;
      }

      logger.info(`Mock rule matched: ${rule.name} for ${context.url}`);
      return await this._generateResponse(context, rule);
    }

    return null;
  }

  getRules(): MockRule[] {
    return [...this.rules];
  }

  clear(): void {
    this.rules = [];
    logger.debug('All mock rules cleared');
  }

  private _matchPattern(url: string, pattern: string | RegExp): boolean {
    if (typeof pattern === 'string') {
      return url.includes(pattern);
    } else {
      return pattern.test(url);
    }
  }

  private _matchMethod(
    contextMethod: string | undefined,
    ruleMethod: string | string[]
  ): boolean {
    if (!contextMethod) return true;
    
    const methods = Array.isArray(ruleMethod) ? ruleMethod : [ruleMethod];
    return methods.some(m => m.toUpperCase() === contextMethod.toUpperCase());
  }

  private async _generateResponse(
    context: RequestContext,
    rule: MockRule
  ): Promise<ResponseContext> {
    if (rule.delay && rule.delay > 0) {
      await new Promise(resolve => setTimeout(resolve, rule.delay));
    }

    let data: any;
    if (typeof rule.response === 'function') {
      data = await Promise.resolve(rule.response(context));
    } else {
      data = rule.response;
    }

    return {
      id: context.id,
      status: rule.status,
      statusText: 'OK',
      headers: rule.headers || {},
      data,
      timestamp: Date.now(),
      duration: rule.delay || 0,
    };
  }
}

export class MockGenerator {
  static string(length: number = 10): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  static number(min: number = 0, max: number = 100): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  static boolean(): boolean {
    return Math.random() < 0.5;
  }

  static date(start?: Date, end?: Date): Date {
    const startTime = start ? start.getTime() : Date.now() - 365 * 24 * 60 * 60 * 1000;
    const endTime = end ? end.getTime() : Date.now();
    return new Date(startTime + Math.random() * (endTime - startTime));
  }

  static email(): string {
    return `${this.string(8)}@${this.string(5)}.com`;
  }

  static url(): string {
    return `https://${this.string(10)}.com/${this.string(8)}`;
  }

  static uuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  static pick<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }

  static array<T>(generator: () => T, length?: number): T[] {
    const len = length || this.number(3, 10);
    return Array.from({ length: len }, generator);
  }

  static pagination<T>(
    items: T[],
    page: number = 1,
    pageSize: number = 10
  ) {
    const total = items.length;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    
    return {
      data: items.slice(start, end),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }
}

export function createMockServer(): MockServer {
  return new MockServer();
}

