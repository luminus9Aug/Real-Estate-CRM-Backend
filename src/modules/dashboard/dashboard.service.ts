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

    const [leadCount, propertyCount, pendingCommission, activeFollowups, goalProgress] = await Promise.all([
      this.tenantPrisma.client.lead.count({ where: { deletedAt: null } }),
      this.tenantPrisma.client.property.count({ where: { deletedAt: null } }),
      this.tenantPrisma.client.commissionTransaction.count({
        where: { voidedAt: null, status: CommissionStatus.PENDING },
      }),
      this.tenantPrisma.client.followUp.count({ where: { completedAt: null } }),
      this.calculateGoalProgress(tenantId),
    ]);

    const payload = {
      leads: leadCount,
      properties: propertyCount,
      pendingCommissions: pendingCommission,
      activeFollowups,
      goalProgress,
    };

    await this.redis.setex(key, STATS_TTL_SEC, JSON.stringify(payload));
    return payload;
  }

  private async calculateGoalProgress(tenantId: string): Promise<number> {
    const agents = await this.tenantPrisma.client.user.findMany({
      where: { deletedAt: null, role: { in: ['AGENT', 'MANAGER', 'OWNER'] } },
      include: {
        assignedLeads: {
          where: { deletedAt: null },
        },
      },
    });

    const agentsWithLeads = agents.filter((a) => a.assignedLeads.length > 0);
    if (agentsWithLeads.length === 0) {
      const [totalLeads, convertedLeads] = await Promise.all([
        this.tenantPrisma.client.lead.count({ where: { deletedAt: null } }),
        this.tenantPrisma.client.lead.count({ where: { deletedAt: null, status: 'CONVERTED' } }),
      ]);
      return totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;
    }

    const sumProgress = agentsWithLeads.reduce((acc, agent) => {
      const total = agent.assignedLeads.length;
      const converted = agent.assignedLeads.filter((l) => l.status === 'CONVERTED').length;
      return acc + (converted / total) * 100;
    }, 0);

    return Math.round(sumProgress / agentsWithLeads.length);
  }


  async charts(tenantId: string): Promise<Record<string, unknown>> {
    const key = CACHE_KEYS.dashboardCharts(tenantId);
    const cached = await this.redis.get(key);
    if (cached) {
      return JSON.parse(cached) as Record<string, unknown>;
    }

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

    const payload = {
      leadsByStatus: byStatus,
      leadsBySource: bySource,
      commissionsByMonth: revenueByMonth,
    };

    await this.redis.setex(key, STATS_TTL_SEC, JSON.stringify(payload));
    return payload;
  }

  async activity(tenantId: string): Promise<unknown[]> {
    const key = CACHE_KEYS.dashboardActivity(tenantId);
    const cached = await this.redis.get(key);
    if (cached) {
      const parsed = JSON.parse(cached) as unknown[];
      // Prisma returns Date objects which JSON.parse turns into strings
      // We'll let the interceptor/frontend handle the stringified dates or parse them here if necessary
      // For standard API responses, stringified dates are fine.
      return parsed;
    }

    const payload = await this.tenantPrisma.client.activity.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { user: true, lead: true },
    });

    await this.redis.setex(key, STATS_TTL_SEC, JSON.stringify(payload));
    return payload;
  }
}
