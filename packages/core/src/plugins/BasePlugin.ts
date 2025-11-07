import { Plugin } from '@nginx-js/types';

/**
 * BasePlugin - Base class for business plugins
 */
export abstract class BasePlugin implements Plugin {
  public readonly name: string;
  public readonly version?: string;
  public enabled?: boolean = true;

  constructor(name: string, version?: string) {
    this.name = name;
    this.version = version;
  }

  onInit?(): void | Promise<void>;
  onDestroy?(): void | Promise<void>;
}
