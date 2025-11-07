/**
 * ProxyFactory - Core proxy interception capability
 *
 * Provides generic proxy creation for all interceptors with:
 * - Lifecycle hooks (before/after/error)
 * - Multiple proxy patterns
 * - Centralized API management
 */

import { createLogger } from '../utils/Logger';

const logger = createLogger('ProxyFactory');

export interface ProxyInterceptor<T = any, R = any> {
  name: string;
  before?(target: T, ...args: any[]): any[] | Promise<any[]> | void;
  after?(target: T, result: R, ...args: any[]): R | Promise<R> | void;
  error?(target: T, error: Error, ...args: any[]): void | Promise<void>;
}

export interface ProxyConfig {
  enabled?: boolean;
  debug?: boolean;
  onError?: (error: Error) => void;
}

export class ProxyFactory {
  private static instances: Map<string, ProxyFactory> = new Map();

  static getInstance(name: string): ProxyFactory {
    if (!ProxyFactory.instances.has(name)) {
      ProxyFactory.instances.set(name, new ProxyFactory(name));
    }
    return ProxyFactory.instances.get(name)!;
  }

  private name: string;
  private interceptors: ProxyInterceptor[] = [];
  private config: ProxyConfig;

  private constructor(name: string, config: ProxyConfig = {}) {
    this.name = name;
    this.config = {
      enabled: true,
      debug: false,
      ...config,
    };
  }

  addInterceptor(interceptor: ProxyInterceptor): this {
    this.interceptors.push(interceptor);
    if (this.config.debug) {
      logger.debug(`[${this.name}] Interceptor added: ${interceptor.name}`);
    }
    return this;
  }

  removeInterceptor(name: string): this {
    this.interceptors = this.interceptors.filter(i => i.name !== name);
    if (this.config.debug) {
      logger.debug(`[${this.name}] Interceptor removed: ${name}`);
    }
    return this;
  }

  /** Create function proxy (e.g., for global fetch) */
  createFunctionProxy<F extends (...args: any[]) => any>(
    originalFn: F,
    context?: any
  ): F {
    const self = this;

    return (async function proxiedFunction(...args: any[]) {
      if (!self.config.enabled) {
        return originalFn.apply(context || this, args);
      }

      let modifiedArgs = args;

      for (const interceptor of self.interceptors) {
        if (interceptor.before) {
          try {
            const result = await Promise.resolve(
              interceptor.before(originalFn, ...modifiedArgs)
            );
            if (result !== undefined) {
              modifiedArgs = result;
            }
          } catch (error) {
            self.handleError(error as Error, interceptor.name);
          }
        }
      }

      try {
        let result = await Promise.resolve(
          originalFn.apply(context || this, modifiedArgs)
        );

        for (const interceptor of self.interceptors) {
          if (interceptor.after) {
            try {
              const modifiedResult = await Promise.resolve(
                interceptor.after(originalFn, result, ...(modifiedArgs as Parameters<F>))
              );
              if (modifiedResult !== undefined) {
                result = modifiedResult as ReturnType<F>;
              }
            } catch (error) {
              self.handleError(error as Error, interceptor.name);
            }
          }
        }

        return result;
      } catch (error) {
        for (const interceptor of self.interceptors) {
          if (interceptor.error) {
            try {
              await Promise.resolve(
                interceptor.error(originalFn, error as Error, ...(modifiedArgs as Parameters<F>))
              );
            } catch (err) {
              self.handleError(err as Error, interceptor.name);
            }
          }
        }
        throw error;
      }
    } as F);
  }

  /** Create method proxy for object methods */
  createMethodProxy<T extends object, K extends keyof T>(
    target: T,
    methodName: K
  ): T[K] {
    const originalMethod = target[methodName];

    if (typeof originalMethod !== 'function') {
      throw new Error(`${String(methodName)} is not a function`);
    }

    return this.createFunctionProxy(originalMethod as any, target) as T[K];
  }

  /** Create class proxy (constructor wrapper) */
  createClassProxy<T extends new (...args: any[]) => any>(
    OriginalClass: T,
    methodsToProxy: Array<keyof InstanceType<T>> = []
  ): T {
    const self = this;

    const ProxiedClass = class extends OriginalClass {
      constructor(...args: any[]) {
        super(...args);

        methodsToProxy.forEach(methodName => {
          const originalMethod = (this as any)[methodName];
          if (typeof originalMethod === 'function') {
            (this as any)[methodName] = self.createFunctionProxy(
              originalMethod.bind(this),
              this
            );
          }
        });
      }
    };

    return ProxiedClass as T;
  }

  private handleError(error: Error, interceptorName: string): void {
    const message = `[${this.name}] Error in interceptor "${interceptorName}": ${error.message}`;

    if (this.config.onError) {
      this.config.onError(error);
    } else {
      logger.error(message, error);
    }
  }

  clear(): void {
    this.interceptors = [];
  }

  enable(): void {
    this.config.enabled = true;
  }

  disable(): void {
    this.config.enabled = false;
  }

  getConfig(): ProxyConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<ProxyConfig>): void {
    Object.assign(this.config, config);
  }
}

/**
 * GlobalAPIManager - Manages global API replacement and restoration
 */
export class GlobalAPIManager {
  private static originalAPIs: Map<string, any> = new Map();

  static replace<T>(
    apiName: string,
    newAPI: T,
    getGlobal: () => any = () => window
  ): T | undefined {
    const global = getGlobal();

    if (!global) {
      logger.error(`Global object not found for API: ${apiName}`);
      return undefined;
    }

    if (!GlobalAPIManager.originalAPIs.has(apiName)) {
      const original = global[apiName];
      if (original) {
        GlobalAPIManager.originalAPIs.set(apiName, original);
        logger.debug(`Original API saved: ${apiName}`);
      }
    }

    global[apiName] = newAPI;
    logger.info(`Global API replaced: ${apiName}`);

    return GlobalAPIManager.originalAPIs.get(apiName);
  }

  static restore(
    apiName: string,
    getGlobal: () => any = () => window
  ): boolean {
    const global = getGlobal();

    if (!global) {
      logger.error(`Global object not found for API: ${apiName}`);
      return false;
    }

    const original = GlobalAPIManager.originalAPIs.get(apiName);

    if (original) {
      global[apiName] = original;
      GlobalAPIManager.originalAPIs.delete(apiName);
      logger.info(`Global API restored: ${apiName}`);
      return true;
    }

    logger.warn(`No original API found for: ${apiName}`);
    return false;
  }

  static isReplaced(apiName: string): boolean {
    return GlobalAPIManager.originalAPIs.has(apiName);
  }

  static getOriginal<T>(apiName: string): T | undefined {
    return GlobalAPIManager.originalAPIs.get(apiName);
  }

  static restoreAll(getGlobal: () => any = () => window): void {
    const apiNames = Array.from(GlobalAPIManager.originalAPIs.keys());
    apiNames.forEach(name => GlobalAPIManager.restore(name, getGlobal));
    logger.info('All global APIs restored');
  }
}

/**
 * MethodWrapper - Fine-grained method wrapping utility
 */
export class MethodWrapper<T = any> {
  private original: T;
  private before?: (...args: any[]) => any[] | void;
  private after?: (result: any, ...args: any[]) => any | void;
  private error?: (error: Error, ...args: any[]) => void;

  constructor(original: T) {
    this.original = original;
  }

  onBefore(handler: (...args: any[]) => any[] | void): this {
    this.before = handler;
    return this;
  }

  onAfter(handler: (result: any, ...args: any[]) => any | void): this {
    this.after = handler;
    return this;
  }

  onError(handler: (error: Error, ...args: any[]) => void): this {
    this.error = handler;
    return this;
  }

  wrap(): T {
    if (typeof this.original !== 'function') {
      return this.original;
    }

    const original = this.original as any;
    const before = this.before;
    const after = this.after;
    const error = this.error;

    const wrapped = function (this: any, ...args: any[]) {
      let modifiedArgs = args;
      if (before) {
        const result = before.apply(this, args);
        if (result !== undefined) {
          modifiedArgs = result;
        }
      }

      try {
        let result = original.apply(this, modifiedArgs);

        if (after) {
          const modifiedResult = after.call(this, result, ...modifiedArgs);
          if (modifiedResult !== undefined) {
            result = modifiedResult;
          }
        }

        return result;
      } catch (err) {
        if (error) {
          error.call(this, err as Error, ...modifiedArgs);
        }
        throw err;
      }
    };

    return wrapped as T;
  }
}

export function wrapMethod<T>(method: T): MethodWrapper<T> {
  return new MethodWrapper(method);
}

