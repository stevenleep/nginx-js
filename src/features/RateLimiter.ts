/**
 * RateLimiter - Nginx-like limit_req module for request rate limiting
 */

import { RequestContext } from '../types';
import { createLogger } from '../utils/Logger';

const logger = createLogger('RateLimiter');

export enum RateLimitAlgorithm {
  FIXED_WINDOW = 'fixed_window',
  SLIDING_WINDOW = 'sliding_window',
  TOKEN_BUCKET = 'token_bucket',
  LEAKY_BUCKET = 'leaky_bucket',
}

export interface RateLimitConfig {
  algorithm?: RateLimitAlgorithm;
  windowMs?: number;
  maxRequests?: number;
  keyGenerator?: (context: RequestContext) => string;
  onLimitReached?: (context: RequestContext) => void;
}

interface RequestRecord {
  count: number;
  resetTime: number;
  timestamps: number[];
  tokens?: number;
  lastRefill?: number;
}

export class RateLimiter {
  private algorithm: RateLimitAlgorithm;
  private windowMs: number;
  private maxRequests: number;
  private keyGenerator: (context: RequestContext) => string;
  private onLimitReached?: (context: RequestContext) => void;
  private records: Map<string, RequestRecord> = new Map();

  constructor(config: RateLimitConfig = {}) {
    this.algorithm = config.algorithm || RateLimitAlgorithm.SLIDING_WINDOW;
    this.windowMs = config.windowMs || 60000;
    this.maxRequests = config.maxRequests || 100;
    this.keyGenerator = config.keyGenerator || this._defaultKeyGenerator;
    this.onLimitReached = config.onLimitReached;
  }

  allowRequest(context: RequestContext): boolean {
    const key = this.keyGenerator(context);
    const now = Date.now();

    let record = this.records.get(key);
    if (!record) {
      record = this._createRecord();
      this.records.set(key, record);
    }

    let allowed = false;

    switch (this.algorithm) {
      case RateLimitAlgorithm.FIXED_WINDOW:
        allowed = this._fixedWindow(record, now);
        break;

      case RateLimitAlgorithm.SLIDING_WINDOW:
        allowed = this._slidingWindow(record, now);
        break;

      case RateLimitAlgorithm.TOKEN_BUCKET:
        allowed = this._tokenBucket(record, now);
        break;

      case RateLimitAlgorithm.LEAKY_BUCKET:
        allowed = this._leakyBucket(record, now);
        break;

      default:
        allowed = this._slidingWindow(record, now);
    }

    if (!allowed) {
      logger.warn(`Rate limit exceeded for key: ${key}`);
      if (this.onLimitReached) {
        this.onLimitReached(context);
      }
    }

    return allowed;
  }

  reset(key: string): void {
    this.records.delete(key);
    logger.debug(`Rate limit reset for key: ${key}`);
  }

  resetAll(): void {
    this.records.clear();
    logger.debug('All rate limits reset');
  }

  getStats() {
    return {
      algorithm: this.algorithm,
      windowMs: this.windowMs,
      maxRequests: this.maxRequests,
      totalKeys: this.records.size,
      records: Array.from(this.records.entries()).map(([key, record]) => ({
        key,
        count: record.count,
        remaining: this.maxRequests - record.count,
        resetTime: new Date(record.resetTime).toISOString(),
      })),
    };
  }

  private _createRecord(): RequestRecord {
    return {
      count: 0,
      resetTime: Date.now() + this.windowMs,
      timestamps: [],
      tokens: this.maxRequests,
      lastRefill: Date.now(),
    };
  }

  private _fixedWindow(record: RequestRecord, now: number): boolean {
    if (now >= record.resetTime) {
      record.count = 0;
      record.resetTime = now + this.windowMs;
    }

    // 检查是否超过限制
    if (record.count >= this.maxRequests) {
      return false;
    }

    record.count++;
    return true;
  }

  private _slidingWindow(record: RequestRecord, now: number): boolean {
    const windowStart = now - this.windowMs;
    record.timestamps = record.timestamps.filter(ts => ts > windowStart);

    if (record.timestamps.length >= this.maxRequests) {
      return false;
    }

    record.timestamps.push(now);
    record.count = record.timestamps.length;
    return true;
  }

  private _tokenBucket(record: RequestRecord, now: number): boolean {
    const timePassed = now - (record.lastRefill || now);
    const tokensToAdd = (timePassed / this.windowMs) * this.maxRequests;
    
    record.tokens = Math.min(
      this.maxRequests,
      (record.tokens || 0) + tokensToAdd
    );
    record.lastRefill = now;

    if (record.tokens < 1) {
      return false;
    }

    record.tokens--;
    return true;
  }

  private _leakyBucket(record: RequestRecord, now: number): boolean {
    const timePassed = now - (record.lastRefill || now);
    const leakedRequests = (timePassed / this.windowMs) * this.maxRequests;
    
    record.count = Math.max(0, record.count - leakedRequests);
    record.lastRefill = now;

    if (record.count >= this.maxRequests) {
      return false;
    }

    record.count++;
    return true;
  }

  private _defaultKeyGenerator(context: RequestContext): string {
    return context.url;
  }
}

export enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open',
}

export interface CircuitBreakerConfig {
  failureThreshold?: number;
  successThreshold?: number;
  timeout?: number;
  resetTimeout?: number;
  monitoringPeriod?: number;
}

/**
 * CircuitBreaker - Hystrix-like circuit breaker pattern
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private totalRequests = 0;
  private lastFailureTime?: number;
  private requestTimestamps: number[] = [];

  private failureThreshold: number;
  private successThreshold: number;
  private timeout: number;
  private resetTimeout: number;
  private monitoringPeriod: number;

  constructor(config: CircuitBreakerConfig = {}) {
    this.failureThreshold = config.failureThreshold || 0.5; // 50%
    this.successThreshold = config.successThreshold || 5;
    this.timeout = config.timeout || 30000; // 30秒
    this.resetTimeout = config.resetTimeout || 60000; // 60秒
    this.monitoringPeriod = config.monitoringPeriod || 10000; // 10秒
  }

  /**
   * 检查是否允许请求
   */
  async allow<T>(
    fn: () => Promise<T>,
    _context: RequestContext
  ): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this._shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
        logger.info('Circuit breaker state changed to HALF_OPEN');
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await Promise.race([
        fn(),
        this._timeout(),
      ]);

      this._onSuccess();
      return result as T;
    } catch (error) {
      this._onFailure();
      throw error;
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getStats() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      totalRequests: this.totalRequests,
      failureRate: this.totalRequests > 0
        ? this.failureCount / this.totalRequests
        : 0,
      lastFailureTime: this.lastFailureTime
        ? new Date(this.lastFailureTime).toISOString()
        : null,
    };
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.totalRequests = 0;
    this.requestTimestamps = [];
    logger.info('Circuit breaker manually reset');
  }

  private _onSuccess(): void {
    this.totalRequests++;
    this._cleanOldRequests();

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      
      if (this.successCount >= this.successThreshold) {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        logger.info('Circuit breaker recovered to CLOSED state');
      }
    }
  }

  private _onFailure(): void {
    this.totalRequests++;
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.requestTimestamps.push(Date.now());
    this._cleanOldRequests();

    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN;
      this.successCount = 0;
      logger.warn('Circuit breaker reopened');
      return;
    }

    const failureRate = this.failureCount / this.totalRequests;
    if (failureRate >= this.failureThreshold && this.totalRequests >= 10) {
      this.state = CircuitState.OPEN;
      logger.warn(`Circuit breaker opened (failure rate: ${(failureRate * 100).toFixed(2)}%)`);
    }
  }

  private _shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return false;
    return Date.now() - this.lastFailureTime >= this.resetTimeout;
  }

  private _cleanOldRequests(): void {
    const cutoff = Date.now() - this.monitoringPeriod;
    this.requestTimestamps = this.requestTimestamps.filter(ts => ts > cutoff);
    
    if (this.requestTimestamps.length < this.totalRequests) {
      this.totalRequests = this.requestTimestamps.length;
      this.failureCount = Math.min(this.failureCount, this.totalRequests);
    }
  }

  private _timeout(): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Request timeout'));
      }, this.timeout);
    });
  }
}

export function createRateLimiter(config?: RateLimitConfig): RateLimiter {
  return new RateLimiter(config);
}

export function createCircuitBreaker(config?: CircuitBreakerConfig): CircuitBreaker {
  return new CircuitBreaker(config);
}

