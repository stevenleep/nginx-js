/**
 * CircuitBreaker - Hystrix-like circuit breaker pattern
 */

import { RequestContext } from '@nginx-js/types';
import { createLogger } from '@nginx-js/utils';

const logger = createLogger('CircuitBreaker');

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
  async allow<T>(fn: () => Promise<T>, _context: RequestContext): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this._shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
        logger.info('Circuit breaker state changed to HALF_OPEN');
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await Promise.race([fn(), this._timeout()]);

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
      failureRate: this.totalRequests > 0 ? this.failureCount / this.totalRequests : 0,
      lastFailureTime: this.lastFailureTime ? new Date(this.lastFailureTime).toISOString() : null,
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
    this.requestTimestamps = this.requestTimestamps.filter((ts) => ts > cutoff);

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

export function createCircuitBreaker(config?: CircuitBreakerConfig): CircuitBreaker {
  return new CircuitBreaker(config);
}
