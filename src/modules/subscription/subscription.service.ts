import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SubscriptionStatus, PlanInterval } from '@prisma/client';
import { add, differenceInDays } from 'date-fns';
import { FeatureKey } from '../../common/constants/features.constants';

@Injectable()
export class SubscriptionService {
  constructor(private readonly prisma: PrismaService) {}

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
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      throw new NotFoundException('No active subscription found');
    }

    return subscription;
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
      throw new BadRequestException('No active plan found');
    }

    const feature = tenant.currentPlan.features.find(
      (f) => f.featureKey === featureKey,
    );

    if (!feature) {
      return true; // Feature not defined = no limit
    }

    if (!feature.isEnabled) {
      throw new BadRequestException(
        `Feature ${featureKey} is not enabled in your plan. Please upgrade.`
      );
    }

    if (feature.limit === null) {
      return true; // Unlimited
    }

    if (feature.limit === 0) {
      return false; // Disabled
    }

    return currentUsage < feature.limit;
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
      throw new NotFoundException('Plan not found or inactive');
    }

    const currentSub = await this.prisma.subscription.findFirst({
      where: {
        tenantId,
        status: { in: [SubscriptionStatus.TRIAL, SubscriptionStatus.ACTIVE] },
      },
    });

    if (currentSub?.lastPlanChangeAt) {
      const daysSinceChange = differenceInDays(new Date(), currentSub.lastPlanChangeAt);
      if (daysSinceChange < 30) {
        throw new BadRequestException(
          'Plan changes are limited to once per billing cycle'
        );
      }
    }

    const now = new Date();
    const periodEnd = add(now, {
      months: interval === PlanInterval.MONTHLY ? 1 : interval === PlanInterval.QUARTERLY ? 3 : 12,
    });

    return this.prisma.$transaction(async (tx) => {
      // Create new subscription
      const subscription = await tx.subscription.create({
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

      return subscription;
    });
  }

  async cancelSubscription(tenantId: string, cancelAtPeriodEnd: boolean = true) {
    const subscription = await this.getCurrentSubscription(tenantId);

    if (cancelAtPeriodEnd) {
      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          cancelAtPeriodEnd: true,
          cancelledAt: new Date(),
        },
      });

      return { message: 'Subscription will be cancelled at the end of the current period' };
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

      return { message: 'Subscription cancelled immediately' };
    }
  }
}
