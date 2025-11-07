/**
 * Decorators - Decorator pattern for enhancing request/response
 */

import { RequestContext, ResponseContext } from '@nginx-js/types';
import { getTimestamp } from '@nginx-js/utils';

export interface RequestDecorator {
  decorateRequest(context: RequestContext): RequestContext;
  decorateResponse?(context: RequestContext, response: ResponseContext): ResponseContext;
}

/**
 * DecoratorChain - Applies multiple decorators in sequence
 */
export class DecoratorChain {
  private decorators: RequestDecorator[] = [];

  add(decorator: RequestDecorator): this {
    this.decorators.push(decorator);
    return this;
  }

  applyToRequest(context: RequestContext): RequestContext {
    let result = context;

    for (const decorator of this.decorators) {
      result = decorator.decorateRequest(result);
    }

    return result;
  }

  applyToResponse(context: RequestContext, response: ResponseContext): ResponseContext {
    let result = response;

    for (const decorator of this.decorators) {
      if (decorator.decorateResponse) {
        result = decorator.decorateResponse(context, result);
      }
    }

    return result;
  }

  clear(): void {
    this.decorators = [];
  }
}

export class TimestampDecorator implements RequestDecorator {
  decorateRequest(context: RequestContext): RequestContext {
    context.metadata = context.metadata || {};
    context.metadata.requestTimestamp = getTimestamp();
    context.metadata.requestId = context.id;
    return context;
  }

  decorateResponse(context: RequestContext, response: ResponseContext): ResponseContext {
    response.timestamp = getTimestamp();
    response.duration =
      response.timestamp - (context.metadata?.requestTimestamp || context.timestamp);
    return response;
  }
}

export class TracingDecorator implements RequestDecorator {
  constructor(private traceId?: string) {}

  decorateRequest(context: RequestContext): RequestContext {
    context.headers = context.headers || {};
    context.headers['x-trace-id'] = this.traceId || context.id;
    context.headers['x-request-time'] = new Date().toISOString();

    context.metadata = context.metadata || {};
    context.metadata.traceId = this.traceId || context.id;

    return context;
  }

  decorateResponse(context: RequestContext, response: ResponseContext): ResponseContext {
    response.headers = response.headers || {};
    response.headers['x-trace-id'] = context.metadata?.traceId || context.id;
    return response;
  }
}

export class CompressionDecorator implements RequestDecorator {
  decorateRequest(context: RequestContext): RequestContext {
    context.headers = context.headers || {};
    context.headers['accept-encoding'] = 'gzip, deflate, br';
    return context;
  }

  decorateResponse(_context: RequestContext, response: ResponseContext): ResponseContext {
    const encoding = response.headers?.['content-encoding'];
    if (encoding) {
      response.metadata = response.metadata || {};
      response.metadata.compressed = true;
      response.metadata.encoding = encoding;
    }
    return response;
  }
}

export class SecurityHeadersDecorator implements RequestDecorator {
  decorateRequest(context: RequestContext): RequestContext {
    context.headers = context.headers || {};

    context.headers['x-content-type-options'] = 'nosniff';
    context.headers['x-frame-options'] = 'DENY';
    context.headers['x-xss-protection'] = '1; mode=block';

    return context;
  }
}

export class CorsDecorator implements RequestDecorator {
  constructor(private origin: string = '*') {}

  decorateRequest(context: RequestContext): RequestContext {
    context.headers = context.headers || {};
    context.headers['origin'] = this.origin;
    return context;
  }

  decorateResponse(_context: RequestContext, response: ResponseContext): ResponseContext {
    response.headers = response.headers || {};
    response.headers['access-control-allow-origin'] = this.origin;
    return response;
  }
}
