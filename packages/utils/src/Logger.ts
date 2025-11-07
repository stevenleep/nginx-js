/**
 * Logger - Unified logging interface
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

export interface LoggerOptions {
  level?: LogLevel;
  prefix?: string;
  timestamp?: boolean;
  color?: boolean;
}

/**
 * Logger - Singleton pattern for logging
 */
export class Logger {
  private static instance: Logger;
  private level: LogLevel = LogLevel.INFO;
  private prefix: string = '';
  private timestamp: boolean = true;
  private color: boolean = true;

  private constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? LogLevel.INFO;
    this.prefix = options.prefix || '';
    this.timestamp = options.timestamp ?? true;
    this.color = options.color ?? true;
  }

  static getInstance(options?: LoggerOptions): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(options);
    }
    return Logger.instance;
  }

  static create(prefix: string, options?: LoggerOptions): Logger {
    return new Logger({
      ...options,
      prefix,
    });
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  debug(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.DEBUG) {
      this.log('DEBUG', message, args, '#9E9E9E');
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.INFO) {
      this.log('INFO', message, args, '#2196F3');
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.WARN) {
      this.log('WARN', message, args, '#FF9800');
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.ERROR) {
      this.log('ERROR', message, args, '#F44336');
    }
  }

  group(label: string): void {
    if (this.level !== LogLevel.NONE) {
      console.group(this.formatMessage('GROUP', label));
    }
  }

  groupEnd(): void {
    if (this.level !== LogLevel.NONE) {
      console.groupEnd();
    }
  }

  private log(level: string, message: string, args: any[], color: string): void {
    const formatted = this.formatMessage(level, message);

    if (this.color && typeof window !== 'undefined') {
      console.log(`%c${formatted}`, `color: ${color}; font-weight: bold`, ...args);
    } else {
      console.log(formatted, ...args);
    }
  }

  private formatMessage(level: string, message: string): string {
    const parts: string[] = [];

    if (this.timestamp) {
      parts.push(`[${new Date().toISOString()}]`);
    }

    parts.push(`[${level}]`);

    if (this.prefix) {
      parts.push(`[${this.prefix}]`);
    }

    parts.push(message);

    return parts.join(' ');
  }
}

export const logger = Logger.getInstance();

export function createLogger(name: string, options?: LoggerOptions): Logger {
  return Logger.create(name, options);
}
