import { Injectable } from '@nestjs/common';
import { CommissionStatus } from '@prisma/client';
import { Inject } from '@nestjs/common';
import type Redis from 'ioredis';
import { LeadRepository } from '../lead/lead.repository';
import { PropertyRepository } from '../property/property.repository';
import { CommissionTransactionRepository } from '../commission/commission-transaction.repository';
import { FollowUpRepository } from '../followup/followup.repository';
import { UserRepository } from '../user/user.repository';
import { ActivityRepository } from './activity.repository';
import { AuthUser } from '../auth/types/auth-user.type';
import { CACHE_KEYS } from '../../common/constants/app.constants';
import { REDIS } from '../../redis/redis.module';

const STATS_TTL_SEC = 300;

@Injectable()
export class DashboardService {
  constructor(
    private readonly leadRepo: LeadRepository,
    private readonly propertyRepo: PropertyRepository,
    private readonly commissionRepo: CommissionTransactionRepository,
    private readonly followupRepo: FollowUpRepository,
    private readonly userRepo: UserRepository,
    private readonly activityRepo: ActivityRepository,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async stats(user: AuthUser): Promise<Record<string, unknown>> {
    const tenantId = user.tenantId ?? 'global';
    const key = CACHE_KEYS.dashboardStats(tenantId);
    const cached = await this.redis.get(key);
    if (cached) {
      return JSON.parse(cached) as Record<string, unknown>;
    }

    const [leadCount, propertyCount, pendingCommission, activeFollowups, goalProgress] = await Promise.all([
      this.leadRepo.count(user, { where: { deletedAt: null } }),
      this.propertyRepo.count(user, { where: { deletedAt: null } }),
      this.commissionRepo.count(user, {
        where: { voidedAt: null, status: CommissionStatus.PENDING },
      }),
      this.followupRepo.count(user, { where: { completedAt: null } }),
      this.calculateGoalProgress(user),
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

  private async calculateGoalProgress(user: AuthUser): Promise<number> {
    const agents = await this.userRepo.findMany(user, {
      where: { deletedAt: null, role: { in: ['AGENT', 'MANAGER', 'OWNER'] } },
      include: {
        assignedLeads: {
          where: { deletedAt: null },
        },
      },
    }) as any[];

    const agentsWithLeads = agents.filter((a) => a.assignedLeads.length > 0);
    if (agentsWithLeads.length === 0) {
      const [totalLeads, convertedLeads] = await Promise.all([
        this.leadRepo.count(user, { where: { deletedAt: null } }),
        this.leadRepo.count(user, { where: { deletedAt: null, status: 'CONVERTED' } }),
      ]);
      return totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;
    }

    const sumProgress = agentsWithLeads.reduce((acc, agent) => {
      const total = agent.assignedLeads.length;
      const converted = agent.assignedLeads.filter((l: any) => l.status === 'CONVERTED').length;
      return acc + (converted / total) * 100;
    }, 0);

    return Math.round(sumProgress / agentsWithLeads.length);
  }


  async charts(user: AuthUser): Promise<Record<string, unknown>> {
    const tenantId = user.tenantId ?? 'global';
    const key = CACHE_KEYS.dashboardCharts(tenantId);
    const cached = await this.redis.get(key);
    if (cached) {
      return JSON.parse(cached) as Record<string, unknown>;
    }

    const [byStatus, bySource, revenueByMonth] = await Promise.all([
      this.leadRepo.groupBy(user, {
        by: ['status'],
        where: { deletedAt: null },
        _count: { id: true },
      }),
      this.leadRepo.groupBy(user, {
        by: ['source'],
        where: { deletedAt: null },
        _count: { id: true },
      }),
      this.commissionRepo.groupBy(user, {
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

  async activity(user: AuthUser): Promise<unknown[]> {
    const tenantId = user.tenantId ?? 'global';
    const key = CACHE_KEYS.dashboardActivity(tenantId);
    const cached = await this.redis.get(key);
    if (cached) {
      const parsed = JSON.parse(cached) as unknown[];
      // Prisma returns Date objects which JSON.parse turns into strings
      // We'll let the interceptor/frontend handle the stringified dates or parse them here if necessary
      // For standard API responses, stringified dates are fine.
      return parsed;
    }

    const payload = await this.activityRepo.findMany(user, {
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { user: true, lead: true },
    });

    await this.redis.setex(key, STATS_TTL_SEC, JSON.stringify(payload));
    return payload;
  }

  async teamPerformance(user: AuthUser): Promise<unknown[]> {
    const tenantId = user.tenantId ?? 'global';
    const key = CACHE_KEYS.dashboardTeamPerformance(tenantId);
    const cached = await this.redis.get(key);
    if (cached) {
      return JSON.parse(cached) as unknown[];
    }

    const agents = await this.userRepo.findMany(user, {
      where: { deletedAt: null, role: { in: ['AGENT', 'MANAGER', 'OWNER'] } },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        role: true,
      },
    });

    const performance = await Promise.all(
      agents.map(async (agent) => {
        const [leadsAssigned, converted, commissionsResult] = await Promise.all([
          this.leadRepo.count(user, {
            where: { assignedToId: agent.id, deletedAt: null },
          }),
          this.leadRepo.count(user, {
            where: { assignedToId: agent.id, status: 'CONVERTED', deletedAt: null },
          }),
          this.commissionRepo.aggregate(user, {
            where: { agentId: agent.id, status: 'PAID', voidedAt: null },
            _sum: { amount: true },
          }),
        ]);

        const conversionRate = leadsAssigned > 0 ? (converted / leadsAssigned) * 100 : 0;
        const commission = commissionsResult._sum.amount ? Number(commissionsResult._sum.amount) : 0;

        return {
          agent,
          leadsAssigned,
          contacted: leadsAssigned, // Proxy for now
          converted,
          conversionRate,
          commission,
          targetProgress: Math.min(100, Math.round(conversionRate)), // Proxy for target progress
        };
      })
    );

    // Sort by converted descending
    const payload = performance.sort((a, b) => b.converted - a.converted);

    await this.redis.setex(key, STATS_TTL_SEC, JSON.stringify(payload));
    return payload;
  }
}
