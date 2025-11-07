/**
 * Router - Nginx-like routing for request redirection and matching
 */

import { RequestContext } from '../types';
import { createLogger } from '../utils/Logger';

const logger = createLogger('Router');

export interface RouteRule {
  name: string;
  pattern: string | RegExp;
  target: string | ((context: RequestContext, matches?: RegExpMatchArray) => string);
  weight?: number;
  enabled?: boolean;
  condition?: (context: RequestContext) => boolean;
  type?: 'redirect' | 'rewrite' | 'proxy';
}

export interface RouteMatch {
  rule: RouteRule;
  targetUrl: string;
  matches?: RegExpMatchArray;
}

export class Router {
  private rules: RouteRule[] = [];

  addRule(rule: RouteRule): this {
    this.rules.push({
      enabled: true,
      type: 'rewrite',
      weight: 1,
      ...rule,
    });
    logger.debug(`Route rule added: ${rule.name}`);
    return this;
  }

  addRules(rules: RouteRule[]): this {
    rules.forEach(rule => this.addRule(rule));
    return this;
  }

  removeRule(name: string): this {
    this.rules = this.rules.filter(rule => rule.name !== name);
    logger.debug(`Route rule removed: ${name}`);
    return this;
  }

  enableRule(name: string): this {
    const rule = this.rules.find(r => r.name === name);
    if (rule) {
      rule.enabled = true;
      logger.debug(`Route rule enabled: ${name}`);
    }
    return this;
  }

  disableRule(name: string): this {
    const rule = this.rules.find(r => r.name === name);
    if (rule) {
      rule.enabled = false;
      logger.debug(`Route rule disabled: ${name}`);
    }
    return this;
  }

  match(context: RequestContext): RouteMatch | null {
    for (const rule of this.rules) {
      if (!rule.enabled) {
        continue;
      }

      if (rule.condition && !rule.condition(context)) {
        continue;
      }

      const matches = this._matchPattern(context.url, rule.pattern);
      if (matches) {
        const targetUrl = this._resolveTarget(rule.target, context, matches);
        
        logger.info(`Route matched: ${rule.name} | ${context.url} -> ${targetUrl}`);
        
        return {
          rule,
          targetUrl,
          matches,
        };
      }
    }

    return null;
  }

  route(context: RequestContext): RequestContext {
    const match = this.match(context);
    
    if (match) {
      context.metadata = context.metadata || {};
      context.metadata.originalUrl = context.url;
      context.metadata.routeRule = match.rule.name;
      context.metadata.routeType = match.rule.type;
      
      context.url = match.targetUrl;
    }

    return context;
  }

  getRules(): RouteRule[] {
    return [...this.rules];
  }

  clear(): void {
    this.rules = [];
    logger.debug('All route rules cleared');
  }

  private _matchPattern(
    url: string,
    pattern: string | RegExp
  ): RegExpMatchArray | null {
    if (typeof pattern === 'string') {
      const regexPattern = pattern
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.');
      const regex = new RegExp(`^${regexPattern}$`);
      return url.match(regex);
    } else {
      return url.match(pattern);
    }
  }

  private _resolveTarget(
    target: string | ((context: RequestContext, matches?: RegExpMatchArray) => string),
    context: RequestContext,
    matches?: RegExpMatchArray
  ): string {
    if (typeof target === 'function') {
      return target(context, matches);
    }

    if (matches) {
      let result = target;
      matches.forEach((match, index) => {
        result = result.replace(new RegExp(`\\$${index}`, 'g'), match);
      });
      return result;
    }

    return target;
  }
}

export class RouterBuilder {
  private router = new Router();

  /**
   * Add a custom route rule directly
   */
  addRule(rule: RouteRule): this {
    this.router.addRule(rule);
    return this;
  }

  /**
   * Add multiple route rules at once
   */
  addRules(rules: RouteRule[]): this {
    this.router.addRules(rules);
    return this;
  }

  redirect(from: string, to: string, name?: string): this {
    this.router.addRule({
      name: name || `redirect-${from}`,
      pattern: from,
      target: to,
      type: 'redirect',
    });
    return this;
  }

  rewrite(pattern: RegExp, target: string, name?: string): this {
    this.router.addRule({
      name: name || `rewrite-${pattern.source}`,
      pattern,
      target,
      type: 'rewrite',
    });
    return this;
  }

  proxy(from: string, to: string, name?: string): this {
    this.router.addRule({
      name: name || `proxy-${from}`,
      pattern: from,
      target: to,
      type: 'proxy',
    });
    return this;
  }

  apiVersion(fromVersion: string, toVersion: string): this {
    this.router.addRule({
      name: `api-migration-${fromVersion}-to-${toVersion}`,
      pattern: new RegExp(`/api/${fromVersion}/(.*)`),
      target: `/api/${toVersion}/$1`,
      type: 'rewrite',
    });
    return this;
  }

  replaceDomain(fromDomain: string, toDomain: string): this {
    this.router.addRule({
      name: `domain-replace-${fromDomain}`,
      pattern: new RegExp(`https?://${fromDomain}(.*)`),
      target: `https://${toDomain}$1`,
      type: 'rewrite',
    });
    return this;
  }

  build(): Router {
    return this.router;
  }
}

export function createRouter(): RouterBuilder {
  return new RouterBuilder();
}

