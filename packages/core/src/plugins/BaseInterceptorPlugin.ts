import { InterceptorPlugin, PluginType, RequestType, BaseInterceptorConfig } from '@nginx-js/types';
import { PluginManager } from '../PluginManager'; // Relative import is OK within same package

/**
 * BaseInterceptorPlugin - Base class for interceptor plugins
 */
export abstract class BaseInterceptorPlugin implements InterceptorPlugin {
  public readonly name: string;
  public readonly version?: string;
  public readonly type = PluginType.INTERCEPTOR;
  public readonly priority = 0;
  public enabled?: boolean = true;
  public abstract readonly requestType: RequestType;

  protected pluginManager: PluginManager;
  protected config: BaseInterceptorConfig;
  protected installed = false;

  constructor(
    name: string,
    pluginManager: PluginManager,
    config: BaseInterceptorConfig,
    version?: string
  ) {
    this.name = name;
    this.version = version;
    this.pluginManager = pluginManager;
    this.config = config;
  }

  abstract install(): void;
  abstract uninstall(): void;

  isInstalled(): boolean {
    return this.installed;
  }

  protected log(message: string): void {
    if (this.config.debug) {
      console.log(`[${this.name}] ${message}`);
    }
  }
}
