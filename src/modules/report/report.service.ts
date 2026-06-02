import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS } from '../../redis/redis.module';
import { CACHE_KEYS } from '../../common/constants/app.constants';

const REPORT_TTL_SEC = 300;

@Injectable()
export class ReportService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async teamCommission(tenantId: string): Promise<Array<Record<string, unknown>>> {
    const key = CACHE_KEYS.reportTeamCommission(tenantId);
    const cached = await this.redis.get(key);
    if (cached) {
      return JSON.parse(cached) as Array<Record<string, unknown>>;
    }

    const payload = await this.prisma.$queryRaw<
      Array<{
        agentId: string;
        status: string;
        sumAmount: unknown;
        count: number;
      }>
    >`
      SELECT
        agent_id AS "agentId",
        status::text AS "status",
        COALESCE(SUM(amount), 0) AS "sumAmount",
        COUNT(*)::int AS "count"
      FROM commission_transactions
      WHERE tenant_id = ${tenantId} AND voided_at IS NULL
      GROUP BY agent_id, status
      ORDER BY agent_id ASC, status ASC
    `;

    // Handle BigInt from sumAmount if any by stringifying properly
    const serialized = JSON.stringify(payload, (_, v) => (typeof v === 'bigint' ? v.toString() : v));
    await this.redis.setex(key, REPORT_TTL_SEC, serialized);
    return payload;
  }

  async agentPerformance(tenantId: string): Promise<Array<Record<string, unknown>>> {
    const key = CACHE_KEYS.reportAgentPerformance(tenantId);
    const cached = await this.redis.get(key);
    if (cached) {
      return JSON.parse(cached) as Array<Record<string, unknown>>;
    }

    const payload = await this.prisma.$queryRaw<
      Array<{
        assignedToId: string | null;
        status: string;
        count: number;
      }>
    >`
      SELECT
        assigned_to_id AS "assignedToId",
        status::text AS "status",
        COUNT(*)::int AS "count"
      FROM leads
      WHERE tenant_id = ${tenantId} AND deleted_at IS NULL
      GROUP BY assigned_to_id, status
      ORDER BY assigned_to_id ASC NULLS LAST, status ASC
    `;

    const serialized = JSON.stringify(payload, (_, v) => (typeof v === 'bigint' ? v.toString() : v));
    await this.redis.setex(key, REPORT_TTL_SEC, serialized);
    return payload;
  }
}
