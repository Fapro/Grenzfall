import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 60 * 60 * 24 }); // 24-hour TTL

export function get<T>(key: string): T | undefined {
  return cache.get<T>(key);
}

export function set<T>(key: string, value: T): void {
  cache.set(key, value);
}
