import {
  Plugin,
  PluginLifecycle,
  IPluginManager,
  PluginType,
  InterceptorPlugin,
  RequestType,
} from '../types';

/**
 * PluginManager - Manages plugin lifecycle using Chain of Responsibility pattern
 */
export class PluginManager implements IPluginManager {
  private plugins: Map<string, Plugin> = new Map();
  private debug: boolean = false;

  constructor(debug: boolean = false) {
    this.debug = debug;
  }

  register(plugin: Plugin): void {
    if (this.plugins.has(plugin.name)) {
      this.log(`Plugin "${plugin.name}" is already registered. Replacing...`);
    }

    if (plugin.enabled === undefined) {
      plugin.enabled = true;
    }
    if (plugin.type === undefined) {
      plugin.type = PluginType.BUSINESS;
    }
    if (plugin.priority === undefined) {
      plugin.priority = plugin.type === PluginType.INTERCEPTOR ? 0 : 100;
    }

    this.plugins.set(plugin.name, plugin);
    this.log(`Plugin "${plugin.name}" registered successfully (type: ${plugin.type}, priority: ${plugin.priority})`);

    if (this._isInterceptorPlugin(plugin)) {
      plugin.install();
      this.log(`Interceptor plugin "${plugin.name}" installed`);
    }

    if (plugin.onInit) {
      Promise.resolve(plugin.onInit()).catch((error) => {
        console.error(`Error initializing plugin "${plugin.name}":`, error);
      });
    }
  }

  unregister(pluginName: string): void {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      this.log(`Plugin "${pluginName}" not found`);
      return;
    }

    if (this._isInterceptorPlugin(plugin)) {
      plugin.uninstall();
      this.log(`Interceptor plugin "${pluginName}" uninstalled`);
    }

    if (plugin.onDestroy) {
      Promise.resolve(plugin.onDestroy()).catch((error) => {
        console.error(`Error destroying plugin "${pluginName}":`, error);
      });
    }

    this.plugins.delete(pluginName);
    this.log(`Plugin "${pluginName}" unregistered successfully`);
  }

  getPlugin(pluginName: string): Plugin | undefined {
    return this.plugins.get(pluginName);
  }

  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  getPluginsByType(type: PluginType): Plugin[] {
    return Array.from(this.plugins.values()).filter(
      (plugin) => plugin.type === type
    );
  }

  enable(pluginName: string): void {
    const plugin = this.plugins.get(pluginName);
    if (plugin) {
      plugin.enabled = true;

      if (this._isInterceptorPlugin(plugin) && !plugin.isInstalled()) {
        plugin.install();
      }

      this.log(`Plugin "${pluginName}" enabled`);
    }
  }

  disable(pluginName: string): void {
    const plugin = this.plugins.get(pluginName);
    if (plugin) {
      plugin.enabled = false;

      if (this._isInterceptorPlugin(plugin) && plugin.isInstalled()) {
        plugin.uninstall();
      }

      this.log(`Plugin "${pluginName}" disabled`);
    }
  }

  /**
   * Execute plugin hooks in chain (sorted by priority)
   */
  async executeHook<K extends keyof PluginLifecycle>(
    hookName: K,
    ...args: Parameters<NonNullable<PluginLifecycle[K]>>
  ): Promise<any> {
    const enabledPlugins = Array.from(this.plugins.values())
      .filter((plugin) => plugin.enabled !== false)
      .sort((a, b) => (a.priority || 100) - (b.priority || 100));

    let result = args[0];

    for (const plugin of enabledPlugins) {
      const hook = plugin[hookName];
      if (typeof hook === 'function') {
        // Filter callback plugins by request type to avoid duplicate execution
        // Only execute callback plugins that match the current request type
        if (plugin.name.startsWith('__') && plugin.name.endsWith('__')) {
          // This is a callback plugin (e.g., __FetchInterceptorCallbacks__, __XHRInterceptorCallbacks__)
          // Check if the first argument is a context with a type field
          const firstArg = args[0];
          if (firstArg && typeof firstArg === 'object' && 'type' in firstArg) {
            const requestType = (firstArg as any).type;
            // Extract request type from plugin name
            if (plugin.name.includes('Fetch') && requestType !== RequestType.FETCH) {
              continue; // Skip if plugin is for Fetch but request is not Fetch
            }
            if (plugin.name.includes('XHR') && requestType !== RequestType.XHR) {
              continue; // Skip if plugin is for XHR but request is not XHR
            }
            if (plugin.name.includes('WebSocket') && requestType !== RequestType.WEBSOCKET) {
              continue; // Skip if plugin is for WebSocket but request is not WebSocket
            }
          }
        }

        try {
          const hookResult = await Promise.resolve(
            (hook as any).apply(plugin, result !== undefined ? [result, ...args.slice(1)] : args)
          );

          if (hookResult !== undefined) {
            result = hookResult;
          }

          this.log(`Plugin "${plugin.name}" executed hook "${hookName}"`);
        } catch (error) {
          console.error(
            `Error executing hook "${hookName}" in plugin "${plugin.name}":`,
            error
          );
        }
      }
    }

    return result;
  }

  registerMultiple(plugins: Plugin[]): void {
    plugins.forEach((plugin) => this.register(plugin));
  }

  clear(): void {
    const pluginNames = Array.from(this.plugins.keys());
    pluginNames.forEach((name) => this.unregister(name));
  }

  getEnabledCount(): number {
    return Array.from(this.plugins.values()).filter(
      (plugin) => plugin.enabled !== false
    ).length;
  }

  private _isInterceptorPlugin(plugin: Plugin): plugin is InterceptorPlugin {
    return plugin.type === PluginType.INTERCEPTOR &&
           'install' in plugin &&
           'uninstall' in plugin &&
           'isInstalled' in plugin;
  }

  private log(message: string): void {
    if (this.debug) {
      console.log(`[PluginManager] ${message}`);
    }
  }
}
