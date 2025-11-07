/**
 * RateLimiter - Nginx-like limit_req module for request rate limiting
 */

import { RequestContext } from '@nginx-js/types';
import { createLogger } from '@nginx-js/utils';

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
  private cleanupInterval?: ReturnType<typeof setInterval>;
  private maxRecords: number = 1000; // Maximum number of records to prevent memory leak

  constructor(config: RateLimitConfig = {}) {
    this.algorithm = config.algorithm || RateLimitAlgorithm.SLIDING_WINDOW;
    this.windowMs = config.windowMs || 60000;
    this.maxRequests = config.maxRequests || 100;
    this.keyGenerator = config.keyGenerator || ((context) => this._defaultKeyGenerator(context));
    this.onLimitReached = config.onLimitReached;

    // Fixed: Start periodic cleanup to prevent memory leak
    this.startCleanup();
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
        const callback = this.onLimitReached;
        callback(context);
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

  // Fixed: Add cleanup method to remove expired records
  private startCleanup(): void {
    // Clean up expired records every 5 minutes
    this.cleanupInterval = setInterval(
      () => {
        this._cleanupExpiredRecords();
      },
      5 * 60 * 1000
    );
  }

  private _cleanupExpiredRecords(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, record] of this.records.entries()) {
      // Remove records that haven't been accessed for 2x windowMs
      if (now - record.resetTime > this.windowMs * 2) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach((key) => {
      this.records.delete(key);
    });

    // If records exceed maxRecords, remove oldest ones
    if (this.records.size > this.maxRecords) {
      const sortedEntries = Array.from(this.records.entries()).sort(
        (a, b) => a[1].resetTime - b[1].resetTime
      );
      const toRemove = sortedEntries.slice(0, this.records.size - this.maxRecords);
      toRemove.forEach(([key]) => this.records.delete(key));
    }

    if (expiredKeys.length > 0) {
      logger.debug(`Cleaned up ${expiredKeys.length} expired rate limit records`);
    }
  }

  // Fixed: Add destroy method to cleanup resources
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    this.records.clear();
    logger.debug('RateLimiter destroyed');
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
    record.timestamps = record.timestamps.filter((ts) => ts > windowStart);

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

    record.tokens = Math.min(this.maxRequests, (record.tokens || 0) + tokensToAdd);
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

export function createRateLimiter(config?: RateLimitConfig): RateLimiter {
  return new RateLimiter(config);
}
