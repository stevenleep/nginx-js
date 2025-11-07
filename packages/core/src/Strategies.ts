/**
 * Strategies - Strategy pattern for different interception behaviors
 */

import { RequestContext, ResponseContext } from '@nginx-js/types';
import { getTimestamp } from '@nginx-js/utils';

export interface InterceptStrategy {
  readonly name: string;
  handleRequest?(context: RequestContext): RequestContext | Promise<RequestContext>;
  handleResponse?(
    context: RequestContext,
    response: ResponseContext
  ): ResponseContext | Promise<ResponseContext>;
  handleError?(context: RequestContext, error: Error): Error | Promise<Error>;
}

/**
 * StrategyManager - Manages and executes strategies
 */
export class StrategyManager {
  private strategies: Map<string, InterceptStrategy> = new Map();

  register(strategy: InterceptStrategy): void {
    this.strategies.set(strategy.name, strategy);
  }

  unregister(name: string): void {
    this.strategies.delete(name);
  }

  get(name: string): InterceptStrategy | undefined {
    return this.strategies.get(name);
  }

  async executeRequestStrategies(context: RequestContext): Promise<RequestContext> {
    let result = context;

    for (const strategy of this.strategies.values()) {
      if (strategy.handleRequest) {
        const strategyResult = strategy.handleRequest(result);
        result = strategyResult instanceof Promise ? await strategyResult : strategyResult;
      }
    }

    return result;
  }

  async executeResponseStrategies(
    context: RequestContext,
    response: ResponseContext
  ): Promise<ResponseContext> {
    let result = response;

    for (const strategy of this.strategies.values()) {
      if (strategy.handleResponse) {
        const strategyResult = strategy.handleResponse(context, result);
        result = strategyResult instanceof Promise ? await strategyResult : strategyResult;
      }
    }

    return result;
  }

  async executeErrorStrategies(context: RequestContext, error: Error): Promise<Error> {
    let result = error;

    for (const strategy of this.strategies.values()) {
      if (strategy.handleError) {
        const strategyResult = strategy.handleError(context, result);
        result = strategyResult instanceof Promise ? await strategyResult : strategyResult;
      }
    }

    return result;
  }
}

export class RetryStrategy implements InterceptStrategy {
  public readonly name = 'retry';

  constructor(
    private maxRetries: number = 3,
    private retryDelay: number = 1000,
    private shouldRetry: (error: Error, attempt: number) => boolean = () => true
  ) {}

  async handleError(context: RequestContext, error: Error): Promise<Error> {
    const attempt = (context.metadata?.retryAttempt || 0) + 1;

    if (attempt <= this.maxRetries && this.shouldRetry(error, attempt)) {
      context.metadata = context.metadata || {};
      context.metadata.retryAttempt = attempt;
      context.metadata.shouldRetry = true;

      await new Promise((resolve) => setTimeout(resolve, this.retryDelay * attempt));
    }

    return error;
  }
}

export class TimeoutStrategy implements InterceptStrategy {
  public readonly name = 'timeout';

  constructor(private timeout: number = 30000) {}

  handleRequest(context: RequestContext): RequestContext {
    context.metadata = context.metadata || {};
    context.metadata.timeout = this.timeout;
    context.metadata.startTime = getTimestamp();
    return context;
  }

  handleResponse(context: RequestContext, response: ResponseContext): ResponseContext {
    const startTime = context.metadata?.startTime || response.timestamp;
    const duration = response.timestamp - startTime;

    if (duration > this.timeout) {
      throw new Error(`Request timeout after ${String(duration)}ms`);
    }

    return response;
  }
}

export class ThrottleStrategy implements InterceptStrategy {
  public readonly name = 'throttle';
  private lastRequestTime: Map<string, number> = new Map();

  constructor(private interval: number = 1000) {}

  async handleRequest(context: RequestContext): Promise<RequestContext> {
    const now = getTimestamp();
    const lastTime = this.lastRequestTime.get(context.url) || 0;
    const elapsed = now - lastTime;

    if (elapsed < this.interval) {
      await new Promise((resolve) => setTimeout(resolve, this.interval - elapsed));
    }

    this.lastRequestTime.set(context.url, getTimestamp());
    return context;
  }
}
