import { Injectable, Inject } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS } from '../../redis/redis.constants';

const DEFAULT_TTL_SEC = 30 * 24 * 3600; // 30 days

@Injectable()
export class QuotaCounterService {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  private getQuotaKey(tenantId: string, featureKey: string): string {
    if (featureKey === 'MAX_LEADS_PER_MONTH') {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      return `tenant:${tenantId}:quota:${featureKey}:${year}-${month}`;
    }
    return `tenant:${tenantId}:quota:${featureKey}`;
  }

  private getSecondsUntilEndOfMonth(): number {
    const now = new Date();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
    return Math.max(1, Math.floor((endOfMonth.getTime() - now.getTime()) / 1000));
  }

  async increment(tenantId: string, featureKey: string): Promise<number> {
    const key = this.getQuotaKey(tenantId, featureKey);
    const count = await this.redis.incr(key);
    
    // If the key is new, set an appropriate TTL
    if (count === 1) {
      const ttl = featureKey === 'MAX_LEADS_PER_MONTH'
        ? this.getSecondsUntilEndOfMonth()
        : DEFAULT_TTL_SEC;
      await this.redis.expire(key, ttl);
    }
    return count;
  }

  async decrement(tenantId: string, featureKey: string): Promise<number> {
    const key = this.getQuotaKey(tenantId, featureKey);
    const count = await this.redis.decr(key);
    if (count < 0) {
      await this.redis.set(key, 0);
      return 0;
    }
    return count;
  }

  async getCount(tenantId: string, featureKey: string): Promise<number | null> {
    const key = this.getQuotaKey(tenantId, featureKey);
    const cached = await this.redis.get(key);
    return cached !== null ? parseInt(cached, 10) : null;
  }

  async initFromDb(tenantId: string, featureKey: string, count: number): Promise<void> {
    const key = this.getQuotaKey(tenantId, featureKey);
    const ttl = featureKey === 'MAX_LEADS_PER_MONTH'
      ? this.getSecondsUntilEndOfMonth()
      : DEFAULT_TTL_SEC;
    await this.redis.setex(key, ttl, count);
  }
}
