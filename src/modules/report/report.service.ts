import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { CommissionTransactionRepository } from '../commission/commission-transaction.repository';
import { LeadRepository } from '../lead/lead.repository';
import { AuthUser } from '../auth/types/auth-user.type';
import { REDIS } from '../../redis/redis.module';
import { CACHE_KEYS } from '../../common/constants/app.constants';

const REPORT_TTL_SEC = 300;

@Injectable()
export class ReportService {
  constructor(
    private readonly commissionRepo: CommissionTransactionRepository,
    private readonly leadRepo: LeadRepository,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async teamCommission(user: AuthUser): Promise<Array<Record<string, unknown>>> {
    const tenantId = user.tenantId ?? 'global';
    const key = CACHE_KEYS.reportTeamCommission(tenantId);
    const cached = await this.redis.get(key);
    if (cached) {
      return JSON.parse(cached) as Array<Record<string, unknown>>;
    }

    const payload = await this.commissionRepo.getAgentCommissionStats(user);

    // Handle BigInt from sumAmount if any by stringifying properly
    const serialized = JSON.stringify(payload, (_, v) => (typeof v === 'bigint' ? v.toString() : v));
    await this.redis.setex(key, REPORT_TTL_SEC, serialized);
    return payload;
  }

  async agentPerformance(user: AuthUser): Promise<Array<Record<string, unknown>>> {
    const tenantId = user.tenantId ?? 'global';
    const key = CACHE_KEYS.reportAgentPerformance(tenantId);
    const cached = await this.redis.get(key);
    if (cached) {
      return JSON.parse(cached) as Array<Record<string, unknown>>;
    }

    const payload = await this.leadRepo.getAgentLeadStats(user);

    const serialized = JSON.stringify(payload, (_, v) => (typeof v === 'bigint' ? v.toString() : v));
    await this.redis.setex(key, REPORT_TTL_SEC, serialized);
    return payload;
  }
}
