import {
  RequestType,
  WebSocketRequestContext,
  WebSocketMessageContext,
  WebSocketInterceptorConfig,
  PluginType,
  Plugin,
} from '../types';
import { PluginManager } from '../core/PluginManager';
import { BaseInterceptorPlugin } from '../plugins/BaseInterceptorPlugin';
import { ProxyFactory, GlobalAPIManager } from '../core/ProxyFactory';
import { generateId, getTimestamp } from '../utils/helpers';

/**
 * WebSocketInterceptorPlugin - Intercepts WebSocket using ProxyFactory
 */
export class WebSocketInterceptorPlugin extends BaseInterceptorPlugin {
  public readonly requestType = RequestType.WEBSOCKET;
  private proxyFactory: ProxyFactory;
  private originalWebSocket: typeof WebSocket;

  constructor(pluginManager: PluginManager, config: WebSocketInterceptorConfig = {}) {
    super('WebSocketInterceptor', pluginManager, config, '1.0.0');
    this.proxyFactory = ProxyFactory.getInstance('websocket');
    this.originalWebSocket = window.WebSocket;
    this._registerConfigCallbacks(pluginManager, config);
  }

  private _registerConfigCallbacks(pluginManager: PluginManager, config: WebSocketInterceptorConfig): void {
    const hasCallbacks =
      config.onBeforeWebSocketOpen ||
      config.onWebSocketOpen ||
      config.onBeforeWebSocketSend ||
      config.onWebSocketMessage ||
      config.onWebSocketError ||
      config.onWebSocketClose;

    if (hasCallbacks) {
      const callbackPlugin: Plugin = {
        name: `__WebSocketInterceptorCallbacks__`,
        version: '1.0.0',
        type: PluginType.BUSINESS,
        priority: 50,
        enabled: true,
        beforeWebSocketOpen: config.onBeforeWebSocketOpen,
        onWebSocketOpen: config.onWebSocketOpen,
        beforeWebSocketSend: config.onBeforeWebSocketSend,
        onWebSocketMessage: config.onWebSocketMessage,
        onWebSocketError: config.onWebSocketError,
        onWebSocketClose: config.onWebSocketClose,
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
    const OriginalWebSocket = this.originalWebSocket;

    class WebSocketProxy extends OriginalWebSocket {
      private _context!: WebSocketRequestContext;

      constructor(url: string | URL, protocols?: string | string[]) {
        const urlString = url.toString();

        if (self.config.urlFilter && !self.config.urlFilter(urlString)) {
          super(url, protocols);
          return;
        }

        const context: WebSocketRequestContext = {
          id: generateId(),
          type: RequestType.WEBSOCKET,
          timestamp: getTimestamp(),
          url: urlString,
          protocols,
          metadata: { ...self.config.globalMetadata },
        };

        // Must call super() before accessing 'this' or executing async operations
        // Execute hooks asynchronously after super() call
        super(context.url, context.protocols);

        this._context = context;
        context.ws = this;

        // Execute hooks after super() and this initialization
        void (async () => {
          try {
            const modifiedContext = await self.pluginManager.executeHook('beforeWebSocketOpen', context) as WebSocketRequestContext | undefined;
            if (modifiedContext && 'type' in modifiedContext && modifiedContext.type === RequestType.WEBSOCKET) {
              Object.assign(context, modifiedContext);
              // Update URL if modified
              if (modifiedContext.url && modifiedContext.url !== urlString) {
                // Note: WebSocket URL cannot be changed after construction
                // This is a limitation of the WebSocket API
              }
            }
          } catch (error) {
            self.log('Error in beforeWebSocketOpen: ' + (error as Error).message);
          }
        })();

        this._setupInterceptors();
      }

      private _setupInterceptors(): void {
        const originalAddEventListener = this.addEventListener.bind(this);

        const originalSend = this.send.bind(this);
        this.send = function (data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
          const wsProxy = this as WebSocketProxy;
          const messageContext: WebSocketMessageContext = {
            id: generateId(),
            data,
            timestamp: getTimestamp(),
            direction: 'send',
          };

          // WebSocket.send is synchronous, so we send immediately
          // Hooks are executed asynchronously but don't block the send
          void (async () => {
            try {
              // Execute hooks - callbacks from config are automatically registered as plugins
              await self.pluginManager.executeHook(
                'beforeWebSocketSend',
                wsProxy._context,
                messageContext
              );
            } catch (error) {
              self.log('Error in beforeWebSocketSend hook: ' + (error as Error).message);
            }
          })();

          // Send immediately (WebSocket.send must be synchronous)
          originalSend(data);
        };

        originalAddEventListener('open', (event: Event) => {
          const wsProxy = this as WebSocketProxy;
          void (async () => {
            try {
              // Execute hooks - callbacks from config are automatically registered as plugins
              await self.pluginManager.executeHook('onWebSocketOpen', wsProxy._context, event);
            } catch (error) {
              self.log('Error in onWebSocketOpen hook: ' + (error as Error).message);
            }
          })();
        });

        originalAddEventListener('message', (event: MessageEvent) => {
          const wsProxy = this as WebSocketProxy;
          const messageContext: WebSocketMessageContext = {
            id: generateId(),
            data: event.data,
            timestamp: getTimestamp(),
            direction: 'receive',
          };

          void (async () => {
            try {
              // Execute hooks - callbacks from config are automatically registered as plugins
              await self.pluginManager.executeHook(
                'onWebSocketMessage',
                wsProxy._context,
                messageContext,
                event
              );
            } catch (error) {
              self.log('Error in onWebSocketMessage hook: ' + (error as Error).message);
            }
          })();
        });

        originalAddEventListener('error', (event: Event) => {
          const wsProxy = this as WebSocketProxy;
          void (async () => {
            try {
              // Execute hooks - callbacks from config are automatically registered as plugins
              await self.pluginManager.executeHook('onWebSocketError', wsProxy._context, event);
            } catch (error) {
              self.log('Error in onWebSocketError hook: ' + (error as Error).message);
            }
          })();
        });

        originalAddEventListener('close', (event: CloseEvent) => {
          const wsProxy = this as WebSocketProxy;
          void (async () => {
            try {
              // Execute hooks - callbacks from config are automatically registered as plugins
              await self.pluginManager.executeHook('onWebSocketClose', wsProxy._context, event);
            } catch (error) {
              self.log('Error in onWebSocketClose hook: ' + (error as Error).message);
            }
          })();
        });
      }
    }

    const proxiedWebSocket = self.proxyFactory.createClassProxy(WebSocketProxy as any, []);
    GlobalAPIManager.replace('WebSocket', proxiedWebSocket);

    this.installed = true;
    this.log('Installed');
  }

  uninstall(): void {
    if (!this.installed) {
      this.log('Not installed');
      return;
    }

    GlobalAPIManager.restore('WebSocket');
    this.proxyFactory.clear();

    this.installed = false;
    this.log('Uninstalled');
  }
}
