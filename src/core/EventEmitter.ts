/**
 * EventEmitter - Observer pattern implementation for event system
 */

type EventHandler = (...args: any[]) => void | Promise<void>;

export class EventEmitter {
  private events: Map<string, Set<EventHandler>> = new Map();
  private maxListeners: number = 10;

  on(event: string, handler: EventHandler): this {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }

    const handlers = this.events.get(event)!;
    
    if (handlers.size >= this.maxListeners) {
      console.warn(
        `Warning: Possible EventEmitter memory leak detected. ` +
        `${handlers.size + 1} ${event} listeners added. ` +
        `Use setMaxListeners() to increase limit.`
      );
    }

    handlers.add(handler);
    return this;
  }

  once(event: string, handler: EventHandler): this {
    const onceHandler = (...args: any[]) => {
      this.off(event, onceHandler);
      return handler(...args);
    };
    return this.on(event, onceHandler);
  }

  off(event: string, handler: EventHandler): this {
    const handlers = this.events.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.events.delete(event);
      }
    }
    return this;
  }

  async emit(event: string, ...args: any[]): Promise<boolean> {
    const handlers = this.events.get(event);
    if (!handlers || handlers.size === 0) {
      return false;
    }

    const promises = Array.from(handlers).map(handler => {
      try {
        return Promise.resolve(handler(...args));
      } catch (error) {
        console.error(`Error in event handler for "${event}":`, error);
        return Promise.resolve();
      }
    });

    await Promise.all(promises);
    return true;
  }

  removeAllListeners(event?: string): this {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
    return this;
  }

  listenerCount(event: string): number {
    return this.events.get(event)?.size || 0;
  }

  setMaxListeners(n: number): this {
    this.maxListeners = n;
    return this;
  }
}

