/**
 * Core utility functions - Timestamp, ID generation, headers, cloning, etc.
 */

// Save the original Date.now reference to prevent it from being overwritten by user code
const originalDateNow = Date.now.bind(Date);

// Record the base time at module load to calculate absolute timestamps unaffected by system time changes
// performance.timeOrigin is the absolute time when the page loaded (unaffected by system time changes)
// performance.now() is relative time (from page load start)
// If performance.timeOrigin is unavailable, use Date.now() as fallback
let timeOrigin: number;
let baseTime: number;

if (typeof performance !== 'undefined') {
  // Check for performance.timeOrigin (some older browsers may not support it)
  // Use type assertion to access potentially non-existent property
  const perf = performance as any;

  if (typeof perf.timeOrigin === 'number' && perf.timeOrigin > 0) {
    // Modern browsers: use performance.timeOrigin (unaffected by system time changes)
    timeOrigin = perf.timeOrigin;
    baseTime = 0; // No additional calculation needed
  } else if (typeof perf.now === 'function') {
    // Older browsers: calculate base time at module load
    // baseTime = current absolute time - performance.now()
    timeOrigin = 0;
    baseTime = originalDateNow() - perf.now();
  } else {
    // performance.now() not supported: fallback to Date.now()
    timeOrigin = 0;
    baseTime = 0;
  }
} else {
  // Performance API not supported at all: fallback to Date.now()
  timeOrigin = 0;
  baseTime = 0;
}

/**
 * Safely get current timestamp (unaffected by system time changes)
 *
 * Uses Performance API to get timestamps, avoiding the impact of system time changes:
 * - If performance.timeOrigin is supported, use timeOrigin + performance.now()
 * - Otherwise use base time calculated at module load + performance.now()
 * - If Performance API is not supported at all, fallback to Date.now()
 *
 * @returns Current timestamp in milliseconds
 */
export function getTimestamp(): number {
  if (typeof performance !== 'undefined') {
    const perf = performance as any;

    if (typeof perf.now === 'function') {
      if (timeOrigin > 0) {
        // Use performance.timeOrigin (most accurate, unaffected by system time changes)
        return Math.floor(timeOrigin + perf.now());
      } else if (baseTime > 0) {
        // Use base time calculated at module load (relatively accurate)
        return Math.floor(baseTime + perf.now());
      }
    }
  }

  // Fallback to Date.now() (may be affected by system time changes)
  return originalDateNow();
}

export function generateId(): string {
  return `${getTimestamp()}-${Math.random().toString(36).substring(2, 11)}`;
}

export function parseHeaders(headerStr: string): Record<string, string> {
  const headers: Record<string, string> = {};
  if (!headerStr) return headers;

  const headerPairs = headerStr.split('\r\n');
  for (const line of headerPairs) {
    const parts = line.split(': ');
    const key = parts.shift();
    const value = parts.join(': ');
    if (key) {
      headers[key.toLowerCase()] = value;
    }
  }
  return headers;
}

export function headersToObject(headers: Headers): Record<string, string> {
  const obj: Record<string, string> = {};
  headers.forEach((value, key) => {
    obj[key] = value;
  });
  return obj;
}

export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as any;
  }

  if (obj instanceof Array) {
    return obj.map((item) => deepClone(item)) as any;
  }

  if (obj instanceof Object) {
    const clonedObj: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }

  return obj;
}

export function safeStringify(obj: any): string {
  try {
    return JSON.stringify(obj);
  } catch (error) {
    return String(obj);
  }
}
