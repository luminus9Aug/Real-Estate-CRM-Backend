import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { SubscriptionStatus, PlanInterval } from "@prisma/client";
import { add, differenceInDays } from "date-fns";
import { FeatureKey } from "../../common/constants/features.constants";
import { UserRole } from "../../common/constants/roles.constants";
import type Redis from "ioredis";
import { REDIS } from "../../redis/redis.module";
import { CACHE_KEYS } from "../../common/constants/app.constants";
import { QuotaCounterService } from "../../common/utils/quota-counter.service";

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly quotaCounter: QuotaCounterService,
  ) {}

  async getCurrentSubscription(tenantId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        tenantId,
        status: { in: [SubscriptionStatus.TRIAL, SubscriptionStatus.ACTIVE] },
      },
      include: {
        plan: {
          include: {
            features: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!subscription) {
      throw new NotFoundException("No active subscription found");
    }

    return subscription;
  }

  private async getAgentsCount(tenantId: string): Promise<number> {
    let count = await this.quotaCounter.getCount(
      tenantId,
      FeatureKey.MAX_AGENTS,
    );
    if (count === null) {
      count = await this.prisma.user.count({
        where: {
          tenantId,
          role: { in: [UserRole.AGENT, UserRole.MANAGER] },
          deletedAt: null,
          isActive: true,
        },
      });
      await this.quotaCounter.initFromDb(
        tenantId,
        FeatureKey.MAX_AGENTS,
        count,
      );
    }
    return count;
  }

  private async getMonthlyLeadsCount(tenantId: string): Promise<number> {
    let count = await this.quotaCounter.getCount(
      tenantId,
      FeatureKey.MAX_LEADS_PER_MONTH,
    );
    if (count === null) {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      count = await this.prisma.lead.count({
        where: {
          tenantId,
          createdAt: { gte: startOfMonth },
          deletedAt: null,
        },
      });
      await this.quotaCounter.initFromDb(
        tenantId,
        FeatureKey.MAX_LEADS_PER_MONTH,
        count,
      );
    }
    return count;
  }

  private async getPropertiesCount(tenantId: string): Promise<number> {
    let count = await this.quotaCounter.getCount(
      tenantId,
      FeatureKey.MAX_PROPERTIES,
    );
    if (count === null) {
      count = await this.prisma.property.count({
        where: {
          tenantId,
          deletedAt: null,
        },
      });
      await this.quotaCounter.initFromDb(
        tenantId,
        FeatureKey.MAX_PROPERTIES,
        count,
      );
    }
    return count;
  }

  async getSubscriptionUsage(tenantId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        tenantId,
        status: { in: [SubscriptionStatus.TRIAL, SubscriptionStatus.ACTIVE] },
      },
      include: {
        plan: {
          include: {
            features: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!subscription || !subscription.plan) {
      return { features: [] };
    }

    const [agentsCount, monthlyLeadsCount, propertiesCount] = await Promise.all(
      [
        this.getAgentsCount(tenantId),
        this.getMonthlyLeadsCount(tenantId),
        this.getPropertiesCount(tenantId),
      ],
    );

    const featureUsage = subscription.plan.features.map((feature) => {
      let used = 0;
      if (feature.featureKey === FeatureKey.MAX_AGENTS) {
        used = agentsCount;
      } else if (feature.featureKey === FeatureKey.MAX_LEADS_PER_MONTH) {
        used = monthlyLeadsCount;
      } else if (feature.featureKey === FeatureKey.MAX_PROPERTIES) {
        used = propertiesCount;
      }

      return {
        featureKey: feature.featureKey,
        used,
        limit: feature.limit,
        isEnabled: feature.isEnabled,
      };
    });

    return { features: featureUsage };
  }

  async validateFeatureLimit(
    tenantId: string,
    featureKey: FeatureKey,
    currentUsage: number,
  ): Promise<boolean> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        currentPlan: {
          include: {
            features: {
              where: { featureKey: featureKey },
            },
          },
        },
      },
    });

    if (!tenant?.currentPlan) {
      throw new BadRequestException("No active plan found");
    }

    const feature = tenant.currentPlan.features.find(
      (f) => f.featureKey === featureKey,
    );
    console.log("tenant Features");
    console.log("feature", feature);

    if (!feature) {
      return true;
    }

    if (!feature.isEnabled) {
      throw new BadRequestException(
        `Feature ${featureKey} is not enabled in your plan. Please upgrade.`,
      );
    }

    if (feature.limit === null) {
      return true; // Unlimited
    }

    if (feature.limit === 0) {
      return false; // Disabled
    }

    let count = await this.quotaCounter.getCount(tenantId, featureKey);
    if (count === null) {
      count = currentUsage;
      await this.quotaCounter.initFromDb(tenantId, featureKey, count);
    }

    return count < feature.limit;
  }

  async changePlan(
    tenantId: string,
    newPlanId: string,
    interval: PlanInterval = PlanInterval.MONTHLY,
  ) {
    const plan = await this.prisma.plan.findUnique({
      where: { id: newPlanId },
    });

    if (!plan || !plan.isActive || plan.deletedAt) {
      throw new NotFoundException("Plan not found or inactive");
    }

    const currentSub = await this.prisma.subscription.findFirst({
      where: {
        tenantId,
        status: { in: [SubscriptionStatus.TRIAL, SubscriptionStatus.ACTIVE] },
      },
    });

    if (currentSub?.lastPlanChangeAt) {
      const daysSinceChange = differenceInDays(
        new Date(),
        currentSub.lastPlanChangeAt,
      );
      if (daysSinceChange < 30) {
        throw new BadRequestException(
          "Plan changes are limited to once per billing cycle",
        );
      }
    }

    const now = new Date();
    const periodEnd = add(now, {
      months:
        interval === PlanInterval.MONTHLY
          ? 1
          : interval === PlanInterval.QUARTERLY
            ? 3
            : 12,
    });

    const subscription = await this.prisma.$transaction(async (tx) => {
      // Create new subscription
      const sub = await tx.subscription.create({
        data: {
          tenantId,
          planId: newPlanId,
          planVersion: plan.version,
          status: SubscriptionStatus.ACTIVE,
          interval,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          lastPlanChangeAt: now,
        },
      });

      // Update tenant
      await tx.tenant.update({
        where: { id: tenantId },
        data: {
          currentPlanId: newPlanId,
          subscriptionStatus: SubscriptionStatus.ACTIVE,
          trialEndsAt: null,
        },
      });

      return sub;
    });

    await this.invalidateSubscriptionCache(tenantId);
    return subscription;
  }

  async cancelSubscription(
    tenantId: string,
    cancelAtPeriodEnd: boolean = true,
  ) {
    const subscription = await this.getCurrentSubscription(tenantId);

    if (cancelAtPeriodEnd) {
      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          cancelAtPeriodEnd: true,
          cancelledAt: new Date(),
        },
      });

      await this.invalidateSubscriptionCache(tenantId);

      return {
        message:
          "Subscription will be cancelled at the end of the current period",
      };
    } else {
      await this.prisma.$transaction([
        this.prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            status: SubscriptionStatus.CANCELLED,
            cancelledAt: new Date(),
          },
        }),
        this.prisma.tenant.update({
          where: { id: tenantId },
          data: {
            subscriptionStatus: SubscriptionStatus.CANCELLED,
            cancelledAt: new Date(),
            dataRetentionUntil: add(new Date(), { days: 30 }),
          },
        }),
      ]);

      await this.invalidateSubscriptionCache(tenantId);

      return { message: "Subscription cancelled immediately" };
    }
  }

  private async invalidateSubscriptionCache(tenantId: string): Promise<void> {
    await this.redis.del(CACHE_KEYS.features(tenantId));
    await this.redis.del(CACHE_KEYS.tenantSub(tenantId));
  }
}
