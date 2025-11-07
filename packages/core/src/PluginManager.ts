import {
  Plugin,
  PluginLifecycle,
  IPluginManager,
  PluginType,
  InterceptorPlugin,
  RequestType,
} from '@nginx-js/types';

/**
 * PluginManager - Manages plugin lifecycle using Chain of Responsibility pattern
 */
export class PluginManager implements IPluginManager {
  private plugins: Map<string, Plugin> = new Map();
  private debug: boolean = false;
  private errorStrategy: 'continue' | 'stop' | 'throw' = 'continue';

  constructor(debug: boolean = false, errorStrategy: 'continue' | 'stop' | 'throw' = 'continue') {
    this.debug = debug;
    this.errorStrategy = errorStrategy;
  }

  setErrorStrategy(strategy: 'continue' | 'stop' | 'throw'): void {
    this.errorStrategy = strategy;
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
    this.log(
      `Plugin "${plugin.name}" registered successfully (type: ${plugin.type}, priority: ${plugin.priority})`
    );

    // REMOVED: Auto-install logic - let InterceptorManager control installation
    // Interceptor plugins should be installed via InterceptorManager.start()

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
    return Array.from(this.plugins.values()).filter((plugin) => plugin.type === type);
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
   * Improved: Uses requestTypes property instead of name matching
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
        // Improved: Use requestTypes property for type filtering
        if (plugin.requestTypes && plugin.requestTypes.length > 0) {
          const firstArg = args[0];
          if (firstArg && typeof firstArg === 'object' && 'type' in firstArg) {
            const requestType = (firstArg as any).type as RequestType;
            if (!plugin.requestTypes.includes(requestType)) {
              continue; // Skip if plugin doesn't support this request type
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
          const errorMessage = `Error executing hook "${hookName}" in plugin "${plugin.name}": ${String(error)}`;

          console.error(errorMessage, error);

          // Improved: Error handling strategy
          switch (this.errorStrategy) {
            case 'stop':
              this.log(`Stopping hook execution due to error in plugin "${plugin.name}"`);
              return result;
            case 'throw':
              throw error;
            case 'continue':
            default:
              // Continue to next plugin
              break;
          }
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
    return Array.from(this.plugins.values()).filter((plugin) => plugin.enabled !== false).length;
  }

  private _isInterceptorPlugin(plugin: Plugin): plugin is InterceptorPlugin {
    return (
      plugin.type === PluginType.INTERCEPTOR &&
      'install' in plugin &&
      'uninstall' in plugin &&
      'isInstalled' in plugin
    );
  }

  private log(message: string): void {
    if (this.debug) {
      console.log(`[PluginManager] ${message}`);
    }
  }
}
