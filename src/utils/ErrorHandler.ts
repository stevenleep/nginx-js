/**
 * ErrorHandler - Unified error handling and error types
 */

import { RequestContext, ResponseContext } from '../types';
import { getTimestamp } from './helpers';

export class InterceptorError extends Error {
  public readonly code: string;
  public readonly context?: RequestContext;
  public readonly response?: ResponseContext;
  public readonly timestamp: number;

  constructor(
    message: string,
    code: string = 'UNKNOWN_ERROR',
    context?: RequestContext,
    response?: ResponseContext
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.context = context;
    this.response = response;
    this.timestamp = getTimestamp();

    Object.setPrototypeOf(this, InterceptorError.prototype);
  }
}

export class NetworkError extends InterceptorError {
  constructor(message: string, context?: RequestContext) {
    super(message, 'NETWORK_ERROR', context);
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

export class TimeoutError extends InterceptorError {
  constructor(message: string, context?: RequestContext) {
    super(message, 'TIMEOUT_ERROR', context);
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

export class AbortError extends InterceptorError {
  constructor(message: string, context?: RequestContext) {
    super(message, 'ABORT_ERROR', context);
    Object.setPrototypeOf(this, AbortError.prototype);
  }
}

export class ValidationError extends InterceptorError {
  constructor(message: string, context?: RequestContext) {
    super(message, 'VALIDATION_ERROR', context);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class PluginError extends InterceptorError {
  public readonly pluginName: string;

  constructor(message: string, pluginName: string, context?: RequestContext) {
    super(message, 'PLUGIN_ERROR', context);
    this.pluginName = pluginName;
    Object.setPrototypeOf(this, PluginError.prototype);
  }
}

export interface ErrorHandler {
  handle(error: Error, context?: RequestContext): void;
  canHandle(error: Error): boolean;
}

/**
 * ErrorHandlerChain - Chain of Responsibility pattern for error handling
 */
export class ErrorHandlerChain {
  private handlers: ErrorHandler[] = [];

  add(handler: ErrorHandler): this {
    this.handlers.push(handler);
    return this;
  }

  handle(error: Error, context?: RequestContext): boolean {
    for (const handler of this.handlers) {
      if (handler.canHandle(error)) {
        try {
          handler.handle(error, context);
          return true;
        } catch (handlerError) {
          console.error('Error in error handler:', handlerError);
        }
      }
    }
    return false;
  }
}

export class NetworkErrorHandler implements ErrorHandler {
  canHandle(error: Error): boolean {
    return error instanceof NetworkError || 
           error.message.includes('network') ||
           error.message.includes('fetch');
  }

  handle(error: Error, context?: RequestContext): void {
    console.error('[Network Error]', {
      message: error.message,
      url: context?.url,
      method: context?.method,
      timestamp: new Date().toISOString(),
    });

    this.reportError(error, context);
  }

  private reportError(_error: Error, _context?: RequestContext): void {
    // Error reporting implementation can be added here
  }
}

export class TimeoutErrorHandler implements ErrorHandler {
  canHandle(error: Error): boolean {
    return error instanceof TimeoutError || 
           error.message.includes('timeout');
  }

  handle(error: Error, context?: RequestContext): void {
    console.warn('[Timeout Error]', {
      message: error.message,
      url: context?.url,
      timestamp: new Date().toISOString(),
    });
  }
}

export class DefaultErrorHandler implements ErrorHandler {
  canHandle(_error: Error): boolean {
    return true;
  }

  handle(error: Error, context?: RequestContext): void {
    console.error('[Error]', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      context,
    });
  }
}

export function createDefaultErrorHandler(): ErrorHandlerChain {
  return new ErrorHandlerChain()
    .add(new NetworkErrorHandler())
    .add(new TimeoutErrorHandler())
    .add(new DefaultErrorHandler());
}

/**
 *  safeExecute - Safely execute a function and handle errors
 */
export async function safeExecute<T>(
  fn: () => T | Promise<T>,
  errorHandler?: (error: Error) => void,
  fallback?: T
): Promise<T | undefined> {
  try {
    return await Promise.resolve(fn());
  } catch (error) {
    if (errorHandler) {
      errorHandler(error as Error);
    } else {
      console.error('Error in safeExecute:', error);
    }
    return fallback;
  }
}

