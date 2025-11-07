/**
 * InterceptorBuilder - Builder pattern for creating and configuring interceptors
 * Moved to main package to avoid circular dependency
 */

import { InterceptorManager } from '@nginx-js/core';
import { XHRInterceptorPlugin } from '@nginx-js/interceptors';
import { FetchInterceptorPlugin } from '@nginx-js/interceptors';
import { WebSocketInterceptorPlugin } from '@nginx-js/interceptors';
import { Plugin, InterceptorConfig } from '@nginx-js/types';

export class InterceptorBuilder {
  private config: InterceptorConfig = {};
  private plugins: Plugin[] = [];
  private interceptors: {
    xhr?: boolean;
    fetch?: boolean;
    websocket?: boolean;
  } = {};

  debug(enabled: boolean = true): this {
    this.config.debug = enabled;
    return this;
  }

  autoStart(enabled: boolean = true): this {
    this.config.autoStart = enabled;
    return this;
  }

  filterUrl(filter: (url: string) => boolean): this {
    this.config.urlFilter = filter;
    return this;
  }

  filterByDomain(...domains: string[]): this {
    this.config.urlFilter = (url) => {
      return domains.some((domain) => url.includes(domain));
    };
    return this;
  }

  filterByPath(...paths: string[]): this {
    this.config.urlFilter = (url) => {
      return paths.some((path) => url.includes(path));
    };
    return this;
  }

  withMetadata(metadata: Record<string, any>): this {
    this.config.globalMetadata = {
      ...this.config.globalMetadata,
      ...metadata,
    };
    return this;
  }

  interceptXHR(): this {
    this.interceptors.xhr = true;
    return this;
  }

  interceptFetch(): this {
    this.interceptors.fetch = true;
    return this;
  }

  interceptWebSocket(): this {
    this.interceptors.websocket = true;
    return this;
  }

  interceptHttp(): this {
    this.interceptors.xhr = true;
    this.interceptors.fetch = true;
    return this;
  }

  interceptAll(): this {
    this.interceptors.xhr = true;
    this.interceptors.fetch = true;
    this.interceptors.websocket = true;
    return this;
  }

  use(plugin: Plugin): this {
    this.plugins.push(plugin);
    return this;
  }

  useMultiple(...plugins: Plugin[]): this {
    this.plugins.push(...plugins);
    return this;
  }

  build(): InterceptorManager {
    const manager = new InterceptorManager(this.config);
    const pluginManager = manager.getPluginManager();

    if (this.interceptors.xhr) {
      manager.use(new XHRInterceptorPlugin(pluginManager, this.config));
    }
    if (this.interceptors.fetch) {
      manager.use(new FetchInterceptorPlugin(pluginManager, this.config));
    }
    if (this.interceptors.websocket) {
      manager.use(new WebSocketInterceptorPlugin(pluginManager, this.config));
    }

    this.plugins.forEach((plugin) => manager.use(plugin));

    if (this.config.autoStart) {
      manager.start();
    }

    return manager;
  }

  start(): InterceptorManager {
    const manager = this.build();
    if (!this.config.autoStart) {
      manager.start();
    }
    return manager;
  }
}

export function createInterceptor(): InterceptorBuilder {
  return new InterceptorBuilder();
}
