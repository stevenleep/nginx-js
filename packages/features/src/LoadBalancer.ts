/**
 * LoadBalancer - Nginx-like load balancing functionality
 */

import { RequestContext } from '@nginx-js/types';
import { createLogger } from '@nginx-js/utils';

const logger = createLogger('LoadBalancer');

export interface BackendServer {
  url: string;
  weight?: number;
  enabled?: boolean;
  healthy?: boolean;
  maxFails?: number;
  currentFails?: number;
  failTimeout?: number;
  lastFailTime?: number;
}

export enum BalanceStrategy {
  ROUND_ROBIN = 'round_robin',
  WEIGHTED_ROUND_ROBIN = 'weighted_round_robin',
  LEAST_CONNECTIONS = 'least_connections',
  IP_HASH = 'ip_hash',
  RANDOM = 'random',
  FASTEST = 'fastest',
}

export class LoadBalancer {
  private servers: BackendServer[] = [];
  private strategy: BalanceStrategy;
  private currentIndex = 0;
  private connectionCounts: Map<string, number> = new Map();
  private responseTimes: Map<string, number[]> = new Map();
  private cleanupInterval?: ReturnType<typeof setInterval>;

  constructor(strategy: BalanceStrategy = BalanceStrategy.ROUND_ROBIN) {
    this.strategy = strategy;
    // Fixed: Start periodic cleanup to prevent memory leak
    this.startCleanup();
  }

  // Fixed: Add cleanup method to prevent memory leak
  private startCleanup(): void {
    // Clean up old response times every 10 minutes
    this.cleanupInterval = setInterval(
      () => {
        this._cleanupOldData();
      },
      10 * 60 * 1000
    );
  }

  private _cleanupOldData(): void {
    // Keep only last 100 response times per server
    for (const [url, times] of this.responseTimes.entries()) {
      if (times.length > 100) {
        this.responseTimes.set(url, times.slice(-100));
      }
    }
  }

  // Fixed: Add destroy method to cleanup resources
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    this.connectionCounts.clear();
    this.responseTimes.clear();
    logger.debug('LoadBalancer destroyed');
  }

  addServer(server: BackendServer): this {
    this.servers.push({
      weight: 1,
      enabled: true,
      healthy: true,
      maxFails: 3,
      currentFails: 0,
      failTimeout: 10000,
      ...server,
    });

    this.connectionCounts.set(server.url, 0);
    this.responseTimes.set(server.url, []);

    logger.info(`Server added: ${server.url}`);
    return this;
  }

  addServers(servers: BackendServer[]): this {
    servers.forEach((server) => this.addServer(server));
    return this;
  }

  removeServer(url: string): this {
    this.servers = this.servers.filter((s) => s.url !== url);
    this.connectionCounts.delete(url);
    this.responseTimes.delete(url);
    logger.info(`Server removed: ${url}`);
    return this;
  }

  getNextServer(context: RequestContext): BackendServer | null {
    const availableServers = this._getHealthyServers();

    if (availableServers.length === 0) {
      logger.error('No healthy servers available');
      return null;
    }

    let server: BackendServer | null = null;

    switch (this.strategy) {
      case BalanceStrategy.ROUND_ROBIN:
        server = this._roundRobin(availableServers);
        break;

      case BalanceStrategy.WEIGHTED_ROUND_ROBIN:
        server = this._weightedRoundRobin(availableServers);
        break;

      case BalanceStrategy.LEAST_CONNECTIONS:
        server = this._leastConnections(availableServers);
        break;

      case BalanceStrategy.IP_HASH:
        server = this._ipHash(availableServers, context);
        break;

      case BalanceStrategy.RANDOM:
        server = this._random(availableServers);
        break;

      case BalanceStrategy.FASTEST:
        server = this._fastest(availableServers);
        break;

      default:
        server = this._roundRobin(availableServers);
    }

    if (server) {
      logger.debug(`Selected server: ${server.url} (strategy: ${this.strategy})`);
    }

    return server;
  }

  incrementConnections(url: string): void {
    const count = this.connectionCounts.get(url) || 0;
    this.connectionCounts.set(url, count + 1);
  }

  decrementConnections(url: string): void {
    const count = this.connectionCounts.get(url) || 0;
    this.connectionCounts.set(url, Math.max(0, count - 1));
  }

  recordResponseTime(url: string, time: number): void {
    const times = this.responseTimes.get(url) || [];
    times.push(time);

    if (times.length > 100) {
      times.shift();
    }

    this.responseTimes.set(url, times);
  }

  markFailed(url: string): void {
    const server = this.servers.find((s) => s.url === url);
    if (!server) return;

    server.currentFails = (server.currentFails || 0) + 1;
    server.lastFailTime = Date.now();

    const maxFails = server.maxFails ?? 3;
    if (server.currentFails >= maxFails) {
      server.healthy = false;
      logger.warn(`Server marked unhealthy: ${url} (fails: ${server.currentFails})`);

      setTimeout(() => {
        this._tryRecoverServer(server);
      }, server.failTimeout);
    }
  }

  markSuccess(url: string): void {
    const server = this.servers.find((s) => s.url === url);
    if (server) {
      server.currentFails = 0;
      if (!server.healthy) {
        server.healthy = true;
        logger.info(`Server recovered: ${url}`);
      }
    }
  }

  setStrategy(strategy: BalanceStrategy): this {
    this.strategy = strategy;
    logger.info(`Strategy changed to: ${strategy}`);
    return this;
  }

  getStats() {
    return {
      strategy: this.strategy,
      totalServers: this.servers.length,
      healthyServers: this._getHealthyServers().length,
      servers: this.servers.map((server) => ({
        url: server.url,
        enabled: server.enabled,
        healthy: server.healthy,
        weight: server.weight,
        connections: this.connectionCounts.get(server.url) || 0,
        avgResponseTime: this._getAverageResponseTime(server.url),
        currentFails: server.currentFails || 0,
      })),
    };
  }

  private _getHealthyServers(): BackendServer[] {
    return this.servers.filter((s) => s.enabled && s.healthy);
  }

  private _roundRobin(servers: BackendServer[]): BackendServer {
    const server = servers[this.currentIndex % servers.length];
    this.currentIndex++;
    return server;
  }

  private _weightedRoundRobin(servers: BackendServer[]): BackendServer {
    const totalWeight = servers.reduce((sum, s) => sum + (s.weight || 1), 0);
    let random = Math.random() * totalWeight;

    for (const server of servers) {
      random -= server.weight || 1;
      if (random <= 0) {
        return server;
      }
    }

    return servers[0];
  }

  private _leastConnections(servers: BackendServer[]): BackendServer {
    return servers.reduce((min, server) => {
      const minCount = this.connectionCounts.get(min.url) || 0;
      const serverCount = this.connectionCounts.get(server.url) || 0;
      return serverCount < minCount ? server : min;
    });
  }

  private _ipHash(servers: BackendServer[], context: RequestContext): BackendServer {
    const ip: string =
      typeof context.metadata?.clientIp === 'string' ? context.metadata.clientIp : context.url;
    const hash = this._hashCode(ip);
    const index = Math.abs(hash) % servers.length;
    return servers[index];
  }

  private _random(servers: BackendServer[]): BackendServer {
    const index = Math.floor(Math.random() * servers.length);
    return servers[index];
  }

  private _fastest(servers: BackendServer[]): BackendServer {
    return servers.reduce((fastest, server) => {
      const fastestTime = this._getAverageResponseTime(fastest.url);
      const serverTime = this._getAverageResponseTime(server.url);
      return serverTime < fastestTime ? server : fastest;
    });
  }

  private _tryRecoverServer(server: BackendServer): void {
    logger.info(`Attempting to recover server: ${server.url}`);
    server.healthy = true;
    server.currentFails = 0;
  }

  private _getAverageResponseTime(url: string): number {
    const times = this.responseTimes.get(url) || [];
    if (times.length === 0) return Infinity;
    return times.reduce((sum, t) => sum + t, 0) / times.length;
  }

  private _hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
  }
}

export function createLoadBalancer(
  strategy: BalanceStrategy = BalanceStrategy.ROUND_ROBIN
): LoadBalancer {
  return new LoadBalancer(strategy);
}
