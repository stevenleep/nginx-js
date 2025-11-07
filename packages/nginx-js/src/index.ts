/**
 * Nginx JS - Nginx for JavaScript
 *
 * A powerful, extensible request proxy library for browser
 * Nginx-like functionality with plugin architecture
 *
 * Core features:
 * - Plugin architecture (interceptors are plugins)
 * - Flexible and extensible
 * - Chain of Responsibility pattern
 * - Full TypeScript support
 * - Multiple design patterns
 * - Enterprise features (routing, load balancing, rate limiting, circuit breaker, mock)
 */

export { InterceptorManager } from '@nginx-js/core';
export { PluginManager } from '@nginx-js/core';
export { EventEmitter } from '@nginx-js/core';
export { InterceptorBuilder, createInterceptor } from './InterceptorBuilder';

export { ProxyFactory, GlobalAPIManager, MethodWrapper, wrapMethod } from '@nginx-js/core';
export type { ProxyInterceptor, ProxyConfig } from '@nginx-js/core';

export { StrategyManager, RetryStrategy, TimeoutStrategy, ThrottleStrategy } from '@nginx-js/core';
export type { InterceptStrategy } from '@nginx-js/core';

export { BasePlugin } from '@nginx-js/core';
export { BaseInterceptorPlugin } from '@nginx-js/core';

export { XHRInterceptorPlugin } from '@nginx-js/interceptors';
export { FetchInterceptorPlugin } from '@nginx-js/interceptors';
export { WebSocketInterceptorPlugin } from '@nginx-js/interceptors';

export {
  DecoratorChain,
  TimestampDecorator,
  TracingDecorator,
  CompressionDecorator,
  SecurityHeadersDecorator,
  CorsDecorator,
} from '@nginx-js/core';
export type { RequestDecorator } from '@nginx-js/core';

export {
  InterceptorError,
  NetworkError,
  TimeoutError,
  AbortError,
  ValidationError,
  PluginError,
  ErrorHandlerChain,
  NetworkErrorHandler,
  TimeoutErrorHandler,
  DefaultErrorHandler,
  createDefaultErrorHandler,
  safeExecute,
} from '@nginx-js/utils';
export type { ErrorHandler } from '@nginx-js/utils';

export {
  Validator,
  RequestValidator,
  ResponseValidator,
  DataValidator,
  createRule,
} from '@nginx-js/utils';
export type { ValidationRule, UrlValidator } from '@nginx-js/utils';

export { Logger, LogLevel, logger, createLogger } from '@nginx-js/utils';

export { Router, RouterBuilder, createRouter } from '@nginx-js/features';
export type { RouteRule, RouteMatch } from '@nginx-js/features';

export { LoadBalancer, createLoadBalancer, BalanceStrategy } from '@nginx-js/features';
export type { BackendServer } from '@nginx-js/features';

export {
  RateLimiter,
  RateLimitAlgorithm,
  CircuitBreaker,
  CircuitState,
  createRateLimiter,
  createCircuitBreaker,
} from '@nginx-js/features';
export type { RateLimitConfig, CircuitBreakerConfig } from '@nginx-js/features';

export { MockServer, createMockServer } from '@nginx-js/features';
export type { MockRule, MockGenerator } from '@nginx-js/features';

export * from '@nginx-js/types';
export * from '@nginx-js/utils';
export * from './presets';

import { createInterceptor } from './InterceptorBuilder';
export default createInterceptor;
