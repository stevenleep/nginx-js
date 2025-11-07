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

export { InterceptorManager } from './core/InterceptorManager';
export { PluginManager } from './core/PluginManager';
export { EventEmitter } from './core/EventEmitter';
export { 
  InterceptorBuilder,
  createInterceptor 
} from './core/InterceptorBuilder';

export {
  ProxyFactory,
  GlobalAPIManager,
  MethodWrapper,
  wrapMethod,
} from './core/ProxyFactory';
export type {
  ProxyInterceptor,
  ProxyConfig,
} from './core/ProxyFactory';

export {
  StrategyManager,
  RetryStrategy,
  TimeoutStrategy,
  ThrottleStrategy,
} from './core/InterceptStrategy';
export type {
  InterceptStrategy,
} from './core/InterceptStrategy';

export { BasePlugin } from './plugins/BasePlugin';
export { BaseInterceptorPlugin } from './plugins/BaseInterceptorPlugin';

export { XHRInterceptorPlugin } from './interceptors/XHRInterceptorPlugin';
export { FetchInterceptorPlugin } from './interceptors/FetchInterceptorPlugin';
export { WebSocketInterceptorPlugin } from './interceptors/WebSocketInterceptorPlugin';

export {
  DecoratorChain,
  TimestampDecorator,
  TracingDecorator,
  CompressionDecorator,
  SecurityHeadersDecorator,
  CorsDecorator,
} from './decorators/RequestDecorator';
export type {
  RequestDecorator,
} from './decorators/RequestDecorator';

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
} from './utils/ErrorHandler';
export type {
  ErrorHandler,
} from './utils/ErrorHandler';

export {
  Validator,
  RequestValidator,
  ResponseValidator,
  DataValidator,
  createRule,
} from './utils/Validator';
export type {
  ValidationRule,
  UrlValidator,
} from './utils/Validator';

export {
  Logger,
  LogLevel,
  logger,
  createLogger,
} from './utils/Logger';

export {
  Router,
  RouterBuilder,
  createRouter,
} from './features/Router';
export type {
  RouteRule,
  RouteMatch,
} from './features/Router';

export {
  LoadBalancer,
  createLoadBalancer,
  BalanceStrategy,
} from './features/LoadBalancer';
export type {
  BackendServer,
} from './features/LoadBalancer';

export {
  RateLimiter,
  RateLimitAlgorithm,
  CircuitBreaker,
  CircuitState,
  createRateLimiter,
  createCircuitBreaker,
} from './features/RateLimiter';
export type {
  RateLimitConfig,
  CircuitBreakerConfig,
} from './features/RateLimiter';

export {
  MockServer,
  createMockServer,
} from './features/MockServer';
export type {
  MockRule,
  MockGenerator,
} from './features/MockServer';

export * from './types';
export * from './utils/helpers';
export * from './presets';

import { createInterceptor } from './core/InterceptorBuilder';
export default createInterceptor;
