import {
  InterceptorConfig,
  Plugin,
  PluginType,
  InterceptorPlugin,
} from '../types';
import { PluginManager } from './PluginManager';

/**
 * InterceptorManager - Manages all plugins (interceptor and business plugins)
 *
 * Design principles:
 * - Interceptors are plugins, can be dynamically registered/unregistered
 * - Users can freely choose needed interceptors
 * - Supports custom interceptor extensions
 * - Unified plugin lifecycle management
 */
export class InterceptorManager {
  private pluginManager: PluginManager;
  private config: InterceptorConfig;

  constructor(config: InterceptorConfig = {}) {
    this.config = {
      autoStart: false,
      debug: false,
      ...config,
    };

    this.pluginManager = new PluginManager(this.config.debug || false);

    // Automatically register callbacks from config as an internal plugin
    this._registerConfigCallbacks();
  }

  /**
   * Register callbacks from config as an internal plugin
   * This makes the system flexible - callbacks work through the same hook mechanism
   */
  private _registerConfigCallbacks(): void {
    const hasCallbacks =
      this.config.onBeforeRequest ||
      this.config.onBeforeSend ||
      this.config.onAfterResponse ||
      this.config.onError ||
      this.config.onComplete ||
      this.config.onBeforeWebSocketOpen ||
      this.config.onWebSocketOpen ||
      this.config.onBeforeWebSocketSend ||
      this.config.onWebSocketMessage ||
      this.config.onWebSocketError ||
      this.config.onWebSocketClose;

    if (hasCallbacks) {
      const callbackPlugin: Plugin = {
        name: '__ConfigCallbacks__',
        version: '1.0.0',
        type: PluginType.BUSINESS,
        priority: 50, // Run after interceptors but before other business plugins
        enabled: true,
        beforeRequest: this.config.onBeforeRequest,
        beforeSend: this.config.onBeforeSend,
        afterResponse: this.config.onAfterResponse,
        onError: this.config.onError,
        onComplete: this.config.onComplete,
        beforeWebSocketOpen: this.config.onBeforeWebSocketOpen,
        onWebSocketOpen: this.config.onWebSocketOpen,
        beforeWebSocketSend: this.config.onBeforeWebSocketSend,
        onWebSocketMessage: this.config.onWebSocketMessage,
        onWebSocketError: this.config.onWebSocketError,
        onWebSocketClose: this.config.onWebSocketClose,
      };

      this.pluginManager.register(callbackPlugin);
    }
  }

  use(plugin: Plugin): this {
    this.pluginManager.register(plugin);
    return this;
  }

  useMultiple(plugins: Plugin[]): this {
    this.pluginManager.registerMultiple(plugins);
    return this;
  }

  removePlugin(pluginName: string): this {
    this.pluginManager.unregister(pluginName);
    return this;
  }

  getPlugin(pluginName: string): Plugin | undefined {
    return this.pluginManager.getPlugin(pluginName);
  }

  getAllPlugins(): Plugin[] {
    return this.pluginManager.getAllPlugins();
  }

  getPluginsByType(type: PluginType): Plugin[] {
    return this.pluginManager.getPluginsByType(type);
  }

  enablePlugin(pluginName: string): this {
    this.pluginManager.enable(pluginName);
    return this;
  }

  disablePlugin(pluginName: string): this {
    this.pluginManager.disable(pluginName);
    return this;
  }

  getPluginManager(): PluginManager {
    return this.pluginManager;
  }

  getConfig(): InterceptorConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<InterceptorConfig>): void {
    Object.assign(this.config, config);
  }

  start(): void {
    const interceptorPlugins = this.getPluginsByType(PluginType.INTERCEPTOR) as InterceptorPlugin[];

    interceptorPlugins.forEach((plugin) => {
      if (plugin.enabled !== false && !plugin.isInstalled()) {
        plugin.install();
      }
    });

    if (this.config.debug) {
      console.log('[InterceptorManager] Started with interceptors:',
        interceptorPlugins.map(p => p.name)
      );
    }
  }

  stop(): void {
    const interceptorPlugins = this.getPluginsByType(PluginType.INTERCEPTOR) as InterceptorPlugin[];

    interceptorPlugins.forEach((plugin) => {
      if (plugin.isInstalled()) {
        plugin.uninstall();
      }
    });

    if (this.config.debug) {
      console.log('[InterceptorManager] Stopped');
    }
  }

  isStarted(): boolean {
    const interceptorPlugins = this.getPluginsByType(PluginType.INTERCEPTOR) as InterceptorPlugin[];
    return interceptorPlugins.some(plugin => plugin.isInstalled());
  }

  destroy(): void {
    this.stop();
    this.pluginManager.clear();

    if (this.config.debug) {
      console.log('[InterceptorManager] Destroyed');
    }
  }

  getStats() {
    const allPlugins = this.getAllPlugins();
    const interceptorPlugins = this.getPluginsByType(PluginType.INTERCEPTOR) as InterceptorPlugin[];
    const businessPlugins = this.getPluginsByType(PluginType.BUSINESS);

    return {
      totalPlugins: allPlugins.length,
      interceptorPlugins: interceptorPlugins.length,
      businessPlugins: businessPlugins.length,
      enabledPlugins: allPlugins.filter(p => p.enabled !== false).length,
      installedInterceptors: interceptorPlugins.filter(p => p.isInstalled()).length,
      plugins: allPlugins.map(p => ({
        name: p.name,
        type: p.type,
        enabled: p.enabled,
        installed: (p as InterceptorPlugin).isInstalled?.() || null,
      })),
    };
  }
}
