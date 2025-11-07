import {
  RequestType,
  RequestContext,
  FetchRequestContext,
  ResponseContext,
  HttpInterceptorConfig,
  PluginType,
  Plugin,
} from '@nginx-js/types';
import { PluginManager } from '@nginx-js/core';
import { BaseInterceptorPlugin } from '@nginx-js/core';
import { ProxyFactory, GlobalAPIManager, ProxyInterceptor } from '@nginx-js/core';
import { generateId, headersToObject, getTimestamp } from '@nginx-js/utils';

// Fixed: Use WeakMap to store context instead of as any
const contextMap = new WeakMap<RequestInit, FetchRequestContext>();
const startTimeMap = new WeakMap<RequestInit, number>();

/**
 * FetchInterceptorPlugin - Intercepts fetch API using ProxyFactory
 * Fixed: Uses WeakMap for type-safe context storage
 */
export class FetchInterceptorPlugin extends BaseInterceptorPlugin {
  public readonly requestType = RequestType.FETCH;
  private proxyFactory: ProxyFactory;

  constructor(pluginManager: PluginManager, config: HttpInterceptorConfig = {}) {
    super('FetchInterceptor', pluginManager, config, '1.0.0');
    this.proxyFactory = ProxyFactory.getInstance('fetch');
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
        name: `__FetchInterceptorCallbacks__`,
        version: '1.0.0',
        type: PluginType.BUSINESS,
        priority: 50,
        enabled: true,
        // Fixed: Use requestTypes instead of name matching
        requestTypes: [RequestType.FETCH],
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

    const fetchInterceptor: ProxyInterceptor<typeof fetch> = {
      name: 'FetchRequestInterceptor',

      before: async (_target, input: RequestInfo | URL, init?: RequestInit) => {
        const url =
          typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

        if (this.config.urlFilter && !this.config.urlFilter(url)) {
          return [input, init];
        }

        const startTime = getTimestamp();
        let context: FetchRequestContext = this._createContext(url, init, startTime);

        try {
          // Execute hooks - callbacks from config are automatically registered as plugins
          const hookResult = (await this.pluginManager.executeHook('beforeRequest', context)) as
            | RequestContext
            | undefined;
          if (hookResult && 'type' in hookResult && hookResult.type === RequestType.FETCH) {
            context = hookResult;
          }

          const hookResult2 = (await this.pluginManager.executeHook('beforeSend', context)) as
            | RequestContext
            | undefined;
          if (hookResult2 && 'type' in hookResult2 && hookResult2.type === RequestType.FETCH) {
            context = hookResult2;
          }

          const modifiedInit: RequestInit = {
            ...init,
            method: context.method,
            body: context.body,
            headers: context.headers,
            mode: context.mode,
            credentials: context.credentials,
            cache: context.cache,
            redirect: context.redirect,
            referrer: context.referrer,
            integrity: context.integrity,
            signal: context.signal,
          };

          // Fixed: Use WeakMap instead of as any
          if (modifiedInit) {
            contextMap.set(modifiedInit, context);
            startTimeMap.set(modifiedInit, startTime);
          }

          return [context.url, modifiedInit];
        } catch (error) {
          this.log('Error in before hooks: ' + (error as Error).message);
          return [input, init];
        }
      },

      after: async (_target, response: Response, _input: RequestInfo | URL, init?: RequestInit) => {
        // Fixed: Use WeakMap instead of as any
        const context = init ? contextMap.get(init) : undefined;
        const startTime = init ? startTimeMap.get(init) : undefined;

        if (!context || !startTime) {
          return response;
        }

        const now = getTimestamp();
        const duration = now - startTime;

        try {
          const clonedResponse = response.clone();
          let data: any;
          try {
            const contentType = response.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
              data = await clonedResponse.json();
            } else if (contentType.includes('text/')) {
              data = await clonedResponse.text();
            }
          } catch {
            data = null;
          }

          let responseContext: ResponseContext = {
            id: context.id,
            status: response.status,
            statusText: response.statusText,
            headers: headersToObject(response.headers),
            data,
            timestamp: now,
            duration,
          };

          // Execute hooks - callbacks from config are automatically registered as plugins
          const hookResult = (await this.pluginManager.executeHook(
            'afterResponse',
            context,
            responseContext
          )) as ResponseContext | undefined;
          if (hookResult) responseContext = hookResult;

          await this.pluginManager.executeHook('onComplete', context, responseContext);

          // Clean up WeakMap entries
          if (init) {
            contextMap.delete(init);
            startTimeMap.delete(init);
          }
        } catch (error) {
          this.log('Error in after hooks: ' + (error as Error).message);
        }

        return response;
      },

      error: async (_target, error: Error, _input: RequestInfo | URL, init?: RequestInit) => {
        // Fixed: Use WeakMap instead of as any
        const context = init ? contextMap.get(init) : undefined;
        const startTime = init ? startTimeMap.get(init) : undefined;

        if (!context || !startTime) {
          return;
        }

        const now = getTimestamp();
        const duration = now - startTime;

        const responseContext: ResponseContext = {
          id: context.id,
          error,
          timestamp: now,
          duration,
        };

        try {
          // Execute hooks - callbacks from config are automatically registered as plugins
          await this.pluginManager.executeHook('onError', context, error);

          await this.pluginManager.executeHook('onComplete', context, responseContext);

          // Clean up WeakMap entries
          if (init) {
            contextMap.delete(init);
            startTimeMap.delete(init);
          }
        } catch (err) {
          this.log('Error in error hooks: ' + (err as Error).message);
        }
      },
    };

    this.proxyFactory.addInterceptor(fetchInterceptor);
    const proxiedFetch = this.proxyFactory.createFunctionProxy(window.fetch, window);
    GlobalAPIManager.replace('fetch', proxiedFetch);

    this.installed = true;
    this.log('Installed');
  }

  uninstall(): void {
    if (!this.installed) {
      this.log('Not installed');
      return;
    }

    GlobalAPIManager.restore('fetch');
    this.proxyFactory.clear();

    this.installed = false;
    this.log('Uninstalled');
  }

  private _createContext(
    url: string,
    init: RequestInit | undefined,
    startTime: number
  ): FetchRequestContext {
    let headers: Record<string, string> = {};
    if (init?.headers) {
      if (init.headers instanceof Headers) {
        headers = headersToObject(init.headers);
      } else if (Array.isArray(init.headers)) {
        init.headers.forEach(([key, value]) => {
          headers[key.toLowerCase()] = value;
        });
      } else {
        for (const [key, value] of Object.entries(init.headers)) {
          headers[key.toLowerCase()] = value;
        }
      }
    }

    return {
      id: generateId(),
      type: RequestType.FETCH,
      timestamp: startTime,
      url,
      method: init?.method?.toUpperCase() || 'GET',
      body: init?.body,
      headers,
      mode: init?.mode,
      credentials: init?.credentials,
      cache: init?.cache,
      redirect: init?.redirect,
      referrer: init?.referrer,
      integrity: init?.integrity,
      signal: init?.signal || undefined,
      init,
      metadata: { ...this.config.globalMetadata },
    };
  }
}
