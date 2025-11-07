/**
 * Presets - Common plugin combinations for quick start
 */

import { InterceptorManager } from '@nginx-js/core';
import { XHRInterceptorPlugin } from '@nginx-js/interceptors';
import { FetchInterceptorPlugin } from '@nginx-js/interceptors';
import { WebSocketInterceptorPlugin } from '@nginx-js/interceptors';
import { InterceptorConfig } from '@nginx-js/types';

export function createFullInterceptor(config: InterceptorConfig = {}): InterceptorManager {
  const manager = new InterceptorManager(config);
  const pluginManager = manager.getPluginManager();

  manager
    .use(new XHRInterceptorPlugin(pluginManager, config))
    .use(new FetchInterceptorPlugin(pluginManager, config))
    .use(new WebSocketInterceptorPlugin(pluginManager, config));

  if (config.autoStart) {
    manager.start();
  }

  return manager;
}

export function createHttpInterceptor(config: InterceptorConfig = {}): InterceptorManager {
  const manager = new InterceptorManager(config);
  const pluginManager = manager.getPluginManager();

  manager
    .use(new XHRInterceptorPlugin(pluginManager, config))
    .use(new FetchInterceptorPlugin(pluginManager, config));

  if (config.autoStart) {
    manager.start();
  }

  return manager;
}

export function createFetchInterceptor(config: InterceptorConfig = {}): InterceptorManager {
  const manager = new InterceptorManager(config);
  const pluginManager = manager.getPluginManager();

  manager.use(new FetchInterceptorPlugin(pluginManager, config));

  if (config.autoStart) {
    manager.start();
  }

  return manager;
}

export function createWebSocketInterceptor(config: InterceptorConfig = {}): InterceptorManager {
  const manager = new InterceptorManager(config);
  const pluginManager = manager.getPluginManager();

  manager.use(new WebSocketInterceptorPlugin(pluginManager, config));

  if (config.autoStart) {
    manager.start();
  }

  return manager;
}
