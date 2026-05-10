import { Injectable } from '@nestjs/common';
import { CommissionStatus } from '@prisma/client';
import { Inject } from '@nestjs/common';
import type Redis from 'ioredis';
import { TenantPrismaService } from '../../common/utils/tenant-prisma.service';
import { CACHE_KEYS } from '../../common/constants/app.constants';
import { REDIS } from '../../redis/redis.module';

const STATS_TTL_SEC = 300;

@Injectable()
export class DashboardService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async stats(tenantId: string): Promise<Record<string, unknown>> {
    const key = CACHE_KEYS.dashboardStats(tenantId);
    const cached = await this.redis.get(key);
    if (cached) {
      return JSON.parse(cached) as Record<string, unknown>;
    }

    const [leadCount, propertyCount, pendingCommission] = await Promise.all([
      this.tenantPrisma.client.lead.count({ where: { deletedAt: null } }),
      this.tenantPrisma.client.property.count({ where: { deletedAt: null } }),
      this.tenantPrisma.client.commissionTransaction.count({
        where: { voidedAt: null, status: CommissionStatus.PENDING },
      }),
    ]);

    const payload = {
      leads: leadCount,
      properties: propertyCount,
      pendingCommissions: pendingCommission,
    };

    await this.redis.setex(key, STATS_TTL_SEC, JSON.stringify(payload));
    return payload;
  }

  async charts(tenantId: string): Promise<Record<string, unknown>> {
    const [byStatus, bySource, revenueByMonth] = await Promise.all([
      this.tenantPrisma.client.lead.groupBy({
        by: ['status'],
        where: { deletedAt: null },
        _count: { id: true },
      }),
      this.tenantPrisma.client.lead.groupBy({
        by: ['source'],
        where: { deletedAt: null },
        _count: { id: true },
      }),
      this.tenantPrisma.client.commissionTransaction.groupBy({
        by: ['calculatedAt'],
        where: { status: CommissionStatus.PAID, voidedAt: null },
        _sum: { amount: true },
      }),
    ]);

    return {
      leadsByStatus: byStatus,
      leadsBySource: bySource,
      commissionsByMonth: revenueByMonth,
    };
  }

  async activity(tenantId: string): Promise<unknown[]> {
    return this.tenantPrisma.client.activity.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { user: true, lead: true },
    });
  }
}
