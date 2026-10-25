import { performance } from 'node:perf_hooks';
import { UserError } from './errors.ts';

/** Tek süreç için sınırlandırılmış TTL tablosu; kullanıcı başına timer açılmaz. */
export class Cooldowns {
  private readonly expires = new Map<string, number>();
  private nextSweep = 0;
  private readonly capacity: number;
  private readonly now: () => number;

  constructor(capacity = 50_000, now: () => number = () => performance.now()) {
    this.capacity = capacity;
    this.now = now;
  }

  consume(key: string, durationMs: number): number {
    if (durationMs <= 0) return 0;
    const now = this.now();
    if (now >= this.nextSweep || this.expires.size >= this.capacity) {
      for (const [entry, expiry] of this.expires) if (expiry <= now) this.expires.delete(entry);
      this.nextSweep = now + 60_000;
    }
    const expiry = this.expires.get(key);
    if (expiry !== undefined && expiry > now) return expiry - now;
    if (this.expires.size >= this.capacity) {
      throw new UserError('Bot şu anda yoğun. Biraz sonra tekrar deneyin.', 'CAPACITY');
    }
    this.expires.set(key, now + durationMs);
    return 0;
  }

  clear(): void {
    this.expires.clear();
  }
}
