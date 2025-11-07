import {
  RequestType,
  RequestContext,
  XHRRequestContext,
  ResponseContext,
  HttpInterceptorConfig,
  PluginType,
  Plugin,
} from '@nginx-js/types';
import { PluginManager } from '@nginx-js/core';
import { BaseInterceptorPlugin } from '@nginx-js/core';
import { ProxyFactory, GlobalAPIManager } from '@nginx-js/core';
import { generateId, parseHeaders, getTimestamp } from '@nginx-js/utils';

/**
 * XHRInterceptorPlugin - Intercepts XMLHttpRequest using ProxyFactory
 * Note: Uses class instance properties for context storage (no WeakMap needed)
 */
export class XHRInterceptorPlugin extends BaseInterceptorPlugin {
  public readonly requestType = RequestType.XHR;
  private proxyFactory: ProxyFactory;
  private originalXHR: typeof XMLHttpRequest;

  constructor(pluginManager: PluginManager, config: HttpInterceptorConfig = {}) {
    super('XHRInterceptor', pluginManager, config, '1.0.0');
    this.proxyFactory = ProxyFactory.getInstance('xhr');
    this.originalXHR = window.XMLHttpRequest;
    this._registerConfigCallbacks(pluginManager, config);
  }

  private _registerConfigCallbacks(
    pluginManager: PluginManager,
    config: HttpInterceptorConfig
  ): void {
    const hasCallbacks =
      config.onBeforeRequest ||
      config.onBeforeSend ||
      config.onAfterResponse ||
      config.onError ||
      config.onComplete;

    if (hasCallbacks) {
      const callbackPlugin: Plugin = {
        name: `__XHRInterceptorCallbacks__`,
        version: '1.0.0',
        type: PluginType.BUSINESS,
        priority: 50,
        enabled: true,
        // Fixed: Use requestTypes instead of name matching
        requestTypes: [RequestType.XHR],
        beforeRequest: config.onBeforeRequest,
        beforeSend: config.onBeforeSend,
        afterResponse: config.onAfterResponse,
        onError: config.onError,
        onComplete: config.onComplete,
      };
      pluginManager.register(callbackPlugin);
    }
  }

  install(): void {
    if (this.installed) {
      this.log('Already installed');
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    // Type guard helper
    const isXHRContext = (ctx: RequestContext | undefined): ctx is XHRRequestContext => {
      return ctx !== undefined && 'type' in ctx && ctx.type === RequestType.XHR;
    };
    const OriginalXHR = this.originalXHR;

    class XHRProxy extends OriginalXHR {
      private _context: XHRRequestContext | null = null;
      private _startTime = 0;

      // Type-safe accessor for context
      private getContext(): XHRRequestContext | null {
        return this._context;
      }

      private setContext(context: XHRRequestContext | null): void {
        this._context = context;
      }

      private getStartTime(): number {
        return this._startTime;
      }

      private setStartTime(time: number): void {
        this._startTime = time;
      }

      constructor() {
        super();
        this._setupInterceptors();
      }

      private _setupInterceptors(): void {
        const originalOpen = this.open.bind(this);
        this.open = function (
          method: string,
          url: string | URL,
          async: boolean = true,
          username?: string | null,
          password?: string | null
        ): void {
          const urlString = url.toString();

          if (self.config.urlFilter && !self.config.urlFilter(urlString)) {
            return originalOpen.call(this, method, urlString, async, username, password);
          }

          // this 指向 XHRProxy 实例
          const xhrProxy = this as XHRProxy;
          xhrProxy.setContext({
            id: generateId(),
            type: RequestType.XHR,
            timestamp: getTimestamp(),
            url: urlString,
            method: method.toUpperCase(),
            headers: {},
            xhr: this,
            metadata: { ...self.config.globalMetadata },
          } as XHRRequestContext);

          originalOpen(method, urlString, async, username, password);
        };

        const originalSetRequestHeader = this.setRequestHeader.bind(this);
        this.setRequestHeader = function (name: string, value: string): void {
          // this 指向 XHRProxy 实例
          const xhrProxy = this as XHRProxy;
          const context = xhrProxy.getContext();
          if (context && context.headers) {
            context.headers[name.toLowerCase()] = value;
          }
          originalSetRequestHeader(name, value);
        };

        const originalSend = this.send.bind(this);
        this.send = function (body?: Document | XMLHttpRequestBodyInit | null): void {
          // this 指向 XHRProxy 实例
          const xhrProxy = this as XHRProxy;
          const context = xhrProxy.getContext();
          if (!context) {
            originalSend(body);
            return;
          }

          context.body = body;
          context.timeout = this.timeout;
          context.withCredentials = this.withCredentials;
          context.responseType = this.responseType;
          xhrProxy.setStartTime(getTimestamp());

          // Execute hooks asynchronously before sending
          void (async () => {
            let currentContext = context;
            try {
              // Execute hooks - callbacks from config are automatically registered as plugins
              const modifiedContext = (await self.pluginManager.executeHook(
                'beforeRequest',
                currentContext
              )) as RequestContext | undefined;
              if (isXHRContext(modifiedContext)) {
                currentContext = modifiedContext;
                xhrProxy.setContext(currentContext);
              }

              const finalContext = (await self.pluginManager.executeHook(
                'beforeSend',
                currentContext
              )) as RequestContext | undefined;
              if (isXHRContext(finalContext)) {
                currentContext = finalContext;
                xhrProxy.setContext(currentContext);
              }

              if (currentContext.headers) {
                for (const key in currentContext.headers) {
                  if (Object.prototype.hasOwnProperty.call(currentContext.headers, key)) {
                    originalSetRequestHeader(key, currentContext.headers[key]);
                  }
                }
              }
            } catch (error) {
              self.log('Error in beforeRequest/beforeSend hooks: ' + (error as Error).message);
            }

            this.addEventListener('load', async () => {
              const ctx = xhrProxy.getContext();
              if (ctx) {
                await self._handleResponse(this, ctx, xhrProxy.getStartTime());
              }
            });

            this.addEventListener('error', async () => {
              const ctx = xhrProxy.getContext();
              if (ctx) {
                await self._handleError(this, ctx, xhrProxy.getStartTime());
              }
            });

            this.addEventListener('abort', async () => {
              const ctx = xhrProxy.getContext();
              if (ctx) {
                await self._handleError(
                  this,
                  ctx,
                  xhrProxy.getStartTime(),
                  new Error('Request aborted')
                );
              }
            });

            this.addEventListener('timeout', async () => {
              const ctx = xhrProxy.getContext();
              if (ctx) {
                await self._handleError(
                  this,
                  ctx,
                  xhrProxy.getStartTime(),
                  new Error('Request timeout')
                );
              }
            });
          })();

          // Send immediately with original body (hooks modify context but send happens synchronously)
          originalSend(context.body ?? null);
        };
      }
    }

    const proxiedXHR = self.proxyFactory.createClassProxy(XHRProxy as any, []);
    GlobalAPIManager.replace('XMLHttpRequest', proxiedXHR);

    this.installed = true;
    this.log('Installed');
  }

  uninstall(): void {
    if (!this.installed) {
      this.log('Not installed');
      return;
    }

    GlobalAPIManager.restore('XMLHttpRequest');
    this.proxyFactory.clear();

    this.installed = false;
    this.log('Uninstalled');
  }

  private async _handleResponse(
    xhr: XMLHttpRequest,
    context: XHRRequestContext,
    startTime: number
  ): Promise<void> {
    const now = getTimestamp();
    const duration = now - startTime;

    const response: ResponseContext = {
      id: context.id,
      status: xhr.status,
      statusText: xhr.statusText,
      headers: parseHeaders(xhr.getAllResponseHeaders()),
      data: xhr.response,
      timestamp: now,
      duration,
    };

    try {
      // Execute hooks - callbacks from config are automatically registered as plugins
      const hookResult = (await this.pluginManager.executeHook(
        'afterResponse',
        context,
        response
      )) as ResponseContext | undefined;
      const currentResponse = hookResult || response;

      await this.pluginManager.executeHook('onComplete', context, currentResponse);
    } catch (error) {
      this.log('Error in response hooks: ' + (error as Error).message);
    }
  }

  private async _handleError(
    xhr: XMLHttpRequest,
    context: XHRRequestContext,
    startTime: number,
    error?: Error
  ): Promise<void> {
    const now = getTimestamp();
    const duration = now - startTime;
    const err = error || new Error(`XHR Error: ${xhr.statusText || 'Unknown error'}`);

    const response: ResponseContext = {
      id: context.id,
      status: xhr.status,
      statusText: xhr.statusText,
      headers: parseHeaders(xhr.getAllResponseHeaders()),
      error: err,
      timestamp: now,
      duration,
    };

    try {
      // Execute hooks - callbacks from config are automatically registered as plugins
      await this.pluginManager.executeHook('onError', context, err);

      await this.pluginManager.executeHook('onComplete', context, response);
    } catch (error) {
      this.log('Error in error hooks: ' + (error as Error).message);
    }
  }
}
