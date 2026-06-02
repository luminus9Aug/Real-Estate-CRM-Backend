import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SubscriptionStatus } from '@prisma/client';
import type Redis from 'ioredis';
import { REDIS } from '../../redis/redis.module';

import { AuditService } from '../audit/audit.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async listAllTenants(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    const [tenants, total] = await Promise.all([
      this.prisma.tenant.findMany({
        skip,
        take: limit,
        include: { currentPlan: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.tenant.count(),
    ]);

    return {
      data: tenants,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getTenantDetails(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        currentPlan: true,
        subscriptions: { take: 5, orderBy: { createdAt: 'desc' } },
        invoices: { take: 5, orderBy: { createdAt: 'desc' } },
        _count: {
          select: {
            users: { where: { deletedAt: null } },
            leads: { where: { deletedAt: null } },
            properties: { where: { deletedAt: null } },
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  async suspendTenant(id: string, adminId: string) {
    const tenant = await this.prisma.tenant.update({
      where: { id },
      data: {
        isActive: false,
        subscriptionStatus: SubscriptionStatus.SUSPENDED,
      },
    });

    await this.audit.log({
      userId: adminId,
      action: 'TENANT_SUSPENDED',
      entity: 'Tenant',
      entityId: id,
      details: { subdomain: tenant.subdomain },
    });

    await this.clearTenantCache(id);

    return tenant;
  }

  async activateTenant(id: string, adminId: string) {
    const tenant = await this.prisma.tenant.update({
      where: { id },
      data: {
        isActive: true,
        subscriptionStatus: SubscriptionStatus.ACTIVE,
      },
    });

    await this.audit.log({
      userId: adminId,
      action: 'TENANT_ACTIVATED',
      entity: 'Tenant',
      entityId: id,
      details: { subdomain: tenant.subdomain },
    });

    await this.clearTenantCache(id);

    return tenant;
  }

  private async clearTenantCache(tenantId: string): Promise<void> {
    const pattern = `tenant:${tenantId}:*`;
    let cursor = '0';
    do {
      const [newCursor, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = newCursor;
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } while (cursor !== '0');
  }

  async getGlobalStats() {
    const [tenantCount, leadCount] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.lead.count({ where: { deletedAt: null } }),
    ]);

    const activeSubs = await this.prisma.subscription.findMany({
      where: { status: SubscriptionStatus.ACTIVE },
      include: { plan: true },
    });

    let mrr = 0;
    for (const sub of activeSubs) {
      const priceMonthly = Number(sub.plan.priceMonthlyINR || sub.plan.priceMonthly || 0);
      const priceYearly = sub.plan.priceYearlyINR
        ? Number(sub.plan.priceYearlyINR)
        : sub.plan.priceYearly
        ? Number(sub.plan.priceYearly)
        : null;

      if (sub.interval === 'YEARLY' && priceYearly) {
        mrr += priceYearly / 12;
      } else {
        mrr += priceMonthly;
      }
    }

    const arr = mrr * 12;
    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [cancelledThisMonth, activeLastMonth] = await Promise.all([
      this.prisma.subscription.count({
        where: {
          status: SubscriptionStatus.CANCELLED,
          cancelledAt: { gte: startOfThisMonth },
        },
      }),
      this.prisma.subscription.count({
        where: {
          createdAt: { lt: startOfThisMonth },
          OR: [
            { status: SubscriptionStatus.ACTIVE },
            { status: SubscriptionStatus.TRIAL },
            {
              status: SubscriptionStatus.CANCELLED,
              cancelledAt: { gte: startOfThisMonth },
            },
          ],
        },
      }),
    ]);

    const churnRate = activeLastMonth > 0 ? (cancelledThisMonth / activeLastMonth) * 100 : 0;

    return {
      totalTenants: tenantCount,
      activeSubscriptions: activeSubs.length,
      mrr,
      arr,
      churnRate,
      totalLeads: leadCount,
    };
  }


  async findAllPlans() {
    return this.prisma.plan.findMany({
      where: { deletedAt: null },
      include: { features: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async createPlan(dto: any) {
    const computed = this.computePricingColumns(dto);

    return this.prisma.$transaction(async (tx) => {
      const plan = await tx.plan.create({
        data: {
          name: dto.name,
          displayName: dto.displayName,
          trialDays: dto.trialDays ?? 0,
          sortOrder: dto.sortOrder ?? 0,
          // Pricing rule columns (admin-controlled)
          basePriceMonthly: computed.basePriceMonthly,
          aedMultiplier: computed.aedMultiplier,
          yearlyDiscountPct: computed.yearlyDiscountPct,
          // Computed currency columns (auto-derived)
          priceMonthly: computed.priceMonthlyINR,
          priceYearly: computed.priceYearlyINR,
          priceMonthlyINR: computed.priceMonthlyINR,
          priceYearlyINR: computed.priceYearlyINR,
          priceMonthlyAED: computed.priceMonthlyAED,
          priceYearlyAED: computed.priceYearlyAED,
        },
      });

      if (dto.features && dto.features.length > 0) {
        await tx.planFeature.createMany({
          data: dto.features.map((f: any) => ({
            planId: plan.id,
            featureKey: f.featureKey,
            type: f.type,
            limit: f.limit,
            isEnabled: f.isEnabled ?? true,
          })),
        });
      }

      return tx.plan.findUnique({
        where: { id: plan.id },
        include: { features: true },
      });
    }, { timeout: 10000 });
  }

  async updatePlan(id: string, dto: any) {
    const existing = await this.prisma.plan.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Plan not found');
    if (existing.isDefault && dto.isActive === false) {
      throw new BadRequestException('Cannot deactivate the default plan');
    }

    const merged = {
      basePriceMonthly: dto.basePriceMonthly ?? Number(existing.basePriceMonthly),
      aedMultiplier: dto.aedMultiplier ?? Number(existing.aedMultiplier),
      yearlyDiscountPct: dto.yearlyDiscountPct ?? Number(existing.yearlyDiscountPct),
    };
    const computed = this.computePricingColumns(merged);

    return this.prisma.$transaction(async (tx) => {
      await tx.plan.update({
        where: { id },
        data: {
          ...(dto.name && { name: dto.name }),
          ...(dto.displayName && { displayName: dto.displayName }),
          ...(dto.trialDays !== undefined && { trialDays: dto.trialDays }),
          ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          // Pricing rule columns
          basePriceMonthly: computed.basePriceMonthly,
          aedMultiplier: computed.aedMultiplier,
          yearlyDiscountPct: computed.yearlyDiscountPct,
          // Computed currency columns
          priceMonthly: computed.priceMonthlyINR,
          priceYearly: computed.priceYearlyINR,
          priceMonthlyINR: computed.priceMonthlyINR,
          priceYearlyINR: computed.priceYearlyINR,
          priceMonthlyAED: computed.priceMonthlyAED,
          priceYearlyAED: computed.priceYearlyAED,
        },
      });

      if (dto.features) {
        await tx.planFeature.deleteMany({ where: { planId: id } });
        await tx.planFeature.createMany({
          data: dto.features.map((f: any) => ({
            planId: id,
            featureKey: f.featureKey,
            type: f.type,
            limit: f.limit,
            isEnabled: f.isEnabled ?? true,
          })),
        });
      }

      return tx.plan.findUnique({
        where: { id },
        include: { features: true },
      });
    }, { timeout: 10000 });
  }

  async deletePlan(id: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (plan?.isDefault) {
      throw new BadRequestException('Cannot delete the default plan');
    }
    return this.prisma.plan.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false, isDefault: false },
    });
  }

  async setDefaultPlan(id: string, adminId: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan || plan.deletedAt) throw new NotFoundException('Plan not found');
    if (!plan.isActive) throw new BadRequestException('Cannot set an inactive plan as default');

    return this.prisma.$transaction(async (tx) => {
      // Unset current default
      await tx.plan.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });

      // Set new default
      const updatedPlan = await tx.plan.update({
        where: { id },
        data: { isDefault: true },
        include: { features: true },
      });

      await this.audit.log({
        userId: adminId,
        action: 'PLAN_SET_DEFAULT',
        entity: 'Plan',
        entityId: id,
        details: { planName: plan.name },
      });

      return updatedPlan;
    }, { timeout: 10000 });
  }

  /**
   * Computes all currency price columns from admin-controlled pricing rules.
   *
   * Formula:
   *   priceMonthlyINR = basePriceMonthly
   *   priceYearlyINR  = floor(basePriceMonthly * 12 * discountFactor)
   *   priceMonthlyAED = floor(basePriceMonthly * aedMultiplier)
   *   priceYearlyAED  = floor(priceMonthlyAED * 12 * discountFactor)
   *
   * where discountFactor = (100 - yearlyDiscountPct) / 100
   *
   * The admin only needs to set 3 values; everything else is derived.
   */
  private computePricingColumns(dto: {
    basePriceMonthly: number;
    aedMultiplier: number;
    yearlyDiscountPct: number;
  }) {
    const base = Number(dto.basePriceMonthly);
    const aedMult = Number(dto.aedMultiplier);
    const discountFactor = (100 - Number(dto.yearlyDiscountPct)) / 100;

    const priceMonthlyINR = base;
    const priceYearlyINR = Math.floor(base * 12 * discountFactor);
    const priceMonthlyAED = Math.floor(base * aedMult);
    const priceYearlyAED = Math.floor(priceMonthlyAED * 12 * discountFactor);

    return {
      basePriceMonthly: base,
      aedMultiplier: aedMult,
      yearlyDiscountPct: Number(dto.yearlyDiscountPct),
      priceMonthlyINR,
      priceYearlyINR,
      priceMonthlyAED,
      priceYearlyAED,
    };
  }

  async getAuditLogs(cursor?: string, limit: number = 20) {
    const take = limit;
    const query: any = {
      take: take + 1,
      orderBy: { createdAt: 'desc' },
    };
    if (cursor) {
      query.cursor = { id: cursor };
      query.skip = 1;
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany(query),
      this.prisma.auditLog.count(),
    ]);

    let nextCursor: string | null = null;
    if (logs.length > take) {
      const nextItem = logs.pop();
      nextCursor = nextItem!.id;
    }

    return {
      data: logs,
      nextCursor,
      total,
    };
  }
}
