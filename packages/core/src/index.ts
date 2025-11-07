/**
 * Core - Core functionality
 */

export { InterceptorManager } from './InterceptorManager';
export { PluginManager } from './PluginManager';
export { EventEmitter } from './EventEmitter';
// InterceptorBuilder moved to main package to avoid circular dependency
export { ProxyFactory, GlobalAPIManager, MethodWrapper, wrapMethod } from './ProxyFactory';
export type { ProxyInterceptor, ProxyConfig } from './ProxyFactory';
export { StrategyManager, RetryStrategy, TimeoutStrategy, ThrottleStrategy } from './Strategies';
export type { InterceptStrategy } from './Strategies';
export { BasePlugin } from './plugins/BasePlugin';
export { BaseInterceptorPlugin } from './plugins/BaseInterceptorPlugin';
export {
  DecoratorChain,
  TimestampDecorator,
  TracingDecorator,
  CompressionDecorator,
  SecurityHeadersDecorator,
  CorsDecorator,
} from './Decorators';
export type { RequestDecorator } from './Decorators';
