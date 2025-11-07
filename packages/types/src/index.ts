/**
 * Core type definitions
 */

export enum RequestType {
  XHR = 'xhr',
  FETCH = 'fetch',
  WEBSOCKET = 'websocket',
}

export enum RequestPhase {
  BEFORE_REQUEST = 'beforeRequest',
  BEFORE_SEND = 'beforeSend',
  AFTER_RESPONSE = 'afterResponse',
  ON_ERROR = 'onError',
  ON_COMPLETE = 'onComplete',
}

export enum WebSocketPhase {
  BEFORE_OPEN = 'beforeOpen',
  ON_OPEN = 'onOpen',
  BEFORE_SEND = 'beforeSend',
  ON_MESSAGE = 'onMessage',
  ON_ERROR = 'onError',
  ON_CLOSE = 'onClose',
}

export interface BaseRequestContext {
  id: string;
  type: RequestType;
  timestamp: number;
  url: string;
  method?: string;
  headers?: Record<string, string>;
  metadata?: Record<string, any>;
}

export interface XHRRequestContext extends BaseRequestContext {
  type: RequestType.XHR;
  method: string;
  body?: any;
  responseType?: XMLHttpRequestResponseType;
  timeout?: number;
  withCredentials?: boolean;
  xhr?: XMLHttpRequest;
}

export interface FetchRequestContext extends BaseRequestContext {
  type: RequestType.FETCH;
  method: string;
  body?: any;
  mode?: RequestMode;
  credentials?: RequestCredentials;
  cache?: RequestCache;
  redirect?: RequestRedirect;
  referrer?: string;
  integrity?: string;
  signal?: AbortSignal;
  init?: RequestInit;
}

export interface WebSocketRequestContext extends BaseRequestContext {
  type: RequestType.WEBSOCKET;
  protocols?: string | string[];
  binaryType?: BinaryType;
  ws?: WebSocket;
}

export type RequestContext = XHRRequestContext | FetchRequestContext | WebSocketRequestContext;

export interface ResponseContext<T = any> {
  id: string;
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  data?: T;
  error?: Error;
  timestamp: number;
  duration: number;
  metadata?: Record<string, any>;
}

export interface WebSocketMessageContext {
  id: string;
  data: any;
  timestamp: number;
  direction: 'send' | 'receive';
}

export interface PluginLifecycle {
  onInit?(): void | Promise<void>;
  beforeRequest?(context: RequestContext): RequestContext | Promise<RequestContext> | void;
  beforeSend?(context: RequestContext): RequestContext | Promise<RequestContext> | void;
  afterResponse?(
    context: RequestContext,
    response: ResponseContext
  ): ResponseContext | Promise<ResponseContext> | void;
  onError?(context: RequestContext, error: Error): Error | Promise<Error> | void;
  onComplete?(context: RequestContext, response?: ResponseContext): void | Promise<void>;
  beforeWebSocketOpen?(
    context: WebSocketRequestContext
  ): WebSocketRequestContext | Promise<WebSocketRequestContext> | void;
  onWebSocketOpen?(context: WebSocketRequestContext, event: Event): void | Promise<void>;
  beforeWebSocketSend?(
    context: WebSocketRequestContext,
    message: WebSocketMessageContext
  ): Promise<unknown> | void;
  onWebSocketMessage?(
    context: WebSocketRequestContext,
    message: WebSocketMessageContext,
    event: MessageEvent
  ): void | Promise<void>;
  onWebSocketError?(context: WebSocketRequestContext, event: Event): void | Promise<void>;
  onWebSocketClose?(context: WebSocketRequestContext, event: CloseEvent): void | Promise<void>;
  onDestroy?(): void | Promise<void>;
}

export enum PluginType {
  INTERCEPTOR = 'interceptor',
  BUSINESS = 'business',
}

export interface Plugin extends PluginLifecycle {
  name: string;
  version?: string;
  enabled?: boolean;
  type?: PluginType;
  priority?: number;
  // Request types this plugin supports (for filtering callbacks)
  requestTypes?: RequestType[];
}

export interface InterceptorPlugin extends Plugin {
  type: PluginType.INTERCEPTOR;
  requestType: RequestType;
  install(): void;
  uninstall(): void;
  isInstalled(): boolean;
}

// Base config for all interceptors
export interface BaseInterceptorConfig {
  globalMetadata?: Record<string, any>;
  urlFilter?: (url: string) => boolean;
  debug?: boolean;
}

// HTTP request interceptors (XHR, Fetch) config
export interface HttpInterceptorConfig extends BaseInterceptorConfig {
  onBeforeRequest?: (context: RequestContext) => RequestContext | Promise<RequestContext> | void;
  onBeforeSend?: (context: RequestContext) => RequestContext | Promise<RequestContext> | void;
  onAfterResponse?: (
    context: RequestContext,
    response: ResponseContext
  ) => ResponseContext | Promise<ResponseContext> | void;
  onError?: (context: RequestContext, error: Error) => Error | Promise<Error> | void;
  onComplete?: (context: RequestContext, response?: ResponseContext) => void | Promise<void>;
}

// WebSocket interceptor config
export interface WebSocketInterceptorConfig extends BaseInterceptorConfig {
  onBeforeWebSocketOpen?: (
    context: WebSocketRequestContext
  ) => WebSocketRequestContext | Promise<WebSocketRequestContext> | void;
  onWebSocketOpen?: (context: WebSocketRequestContext, event: Event) => void | Promise<void>;
  onBeforeWebSocketSend?: (
    context: WebSocketRequestContext,
    message: WebSocketMessageContext
  ) => Promise<unknown> | void;
  onWebSocketMessage?: (
    context: WebSocketRequestContext,
    message: WebSocketMessageContext,
    event: MessageEvent
  ) => void | Promise<void>;
  onWebSocketError?: (context: WebSocketRequestContext, event: Event) => void | Promise<void>;
  onWebSocketClose?: (context: WebSocketRequestContext, event: CloseEvent) => void | Promise<void>;
}

// Full config for InterceptorManager (includes all callbacks)
export interface InterceptorConfig extends BaseInterceptorConfig {
  autoStart?: boolean;
  // Error handling strategy: 'continue' (default), 'stop', 'throw'
  errorStrategy?: 'continue' | 'stop' | 'throw';
  // HTTP request callbacks
  onBeforeRequest?: (context: RequestContext) => RequestContext | Promise<RequestContext> | void;
  onBeforeSend?: (context: RequestContext) => RequestContext | Promise<RequestContext> | void;
  onAfterResponse?: (
    context: RequestContext,
    response: ResponseContext
  ) => ResponseContext | Promise<ResponseContext> | void;
  onError?: (context: RequestContext, error: Error) => Error | Promise<Error> | void;
  onComplete?: (context: RequestContext, response?: ResponseContext) => void | Promise<void>;
  // WebSocket callbacks
  onBeforeWebSocketOpen?: (
    context: WebSocketRequestContext
  ) => WebSocketRequestContext | Promise<WebSocketRequestContext> | void;
  onWebSocketOpen?: (context: WebSocketRequestContext, event: Event) => void | Promise<void>;
  onBeforeWebSocketSend?: (
    context: WebSocketRequestContext,
    message: WebSocketMessageContext
  ) => Promise<unknown> | void;
  onWebSocketMessage?: (
    context: WebSocketRequestContext,
    message: WebSocketMessageContext,
    event: MessageEvent
  ) => void | Promise<void>;
  onWebSocketError?: (context: WebSocketRequestContext, event: Event) => void | Promise<void>;
  onWebSocketClose?: (context: WebSocketRequestContext, event: CloseEvent) => void | Promise<void>;
}

export interface IPluginManager {
  register(plugin: Plugin): void;
  unregister(pluginName: string): void;
  getPlugin(pluginName: string): Plugin | undefined;
  getAllPlugins(): Plugin[];
  getPluginsByType(type: PluginType): Plugin[];
  enable(pluginName: string): void;
  disable(pluginName: string): void;
  executeHook<K extends keyof PluginLifecycle>(
    hookName: K,
    ...args: Parameters<NonNullable<PluginLifecycle[K]>>
  ): Promise<any>;
}
