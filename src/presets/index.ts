/**
 * Presets - Common plugin combinations for quick start
 */

import { InterceptorManager } from '../core/InterceptorManager';
import { XHRInterceptorPlugin } from '../interceptors/XHRInterceptorPlugin';
import { FetchInterceptorPlugin } from '../interceptors/FetchInterceptorPlugin';
import { WebSocketInterceptorPlugin } from '../interceptors/WebSocketInterceptorPlugin';
import { InterceptorConfig } from '../types';

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

