import { Inject, Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS } from '../../redis/redis.module';
import { CACHE_KEYS } from '../constants/app.constants';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole } from '../constants/roles.constants';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/** Structured error codes the frontend can match on. */
export enum SubscriptionErrorCode {
  SUBSCRIPTION_EXPIRED = 'SUBSCRIPTION_EXPIRED',
  TRIAL_EXPIRED = 'TRIAL_EXPIRED',
}

@Injectable()
export class SubscriptionActiveGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const start = Date.now();
    try {
      if (this.isPublicRoute(context)) {
        return true;
      }

      const user = context.switchToHttp().getRequest().user;

      if (!user || user.role === UserRole.SUPER_ADMIN) {
        return true;
      }

      if (!user.tenantId) {
        throw new ForbiddenException('Tenant context required');
      }

      const cacheKey = CACHE_KEYS.tenantSub(user.tenantId);
      let tenant: { subscriptionStatus: string; trialEndsAt: Date | null } | null = null;
      
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        tenant = JSON.parse(cached);
        if (tenant?.trialEndsAt) {
          tenant.trialEndsAt = new Date(tenant.trialEndsAt);
        }
      } else {
        tenant = await this.prisma.tenant.findUnique({
          where: { id: user.tenantId },
          select: { subscriptionStatus: true, trialEndsAt: true },
        });

        if (tenant) {
          await this.redis.setex(cacheKey, 900, JSON.stringify(tenant)); // Cache for 15 mins
        }
      }

      if (!tenant) {
        throw new ForbiddenException('Tenant not found');
      }

      this.validateSubscriptionStatus(tenant);
      this.validateTrialExpiry(tenant);

      return true;
    } finally {
      console.log(`[DEBUG] SubscriptionActiveGuard took ${Date.now() - start}ms`);
    }
  }

  private isPublicRoute(context: ExecutionContext): boolean {
    return this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
  }

  private validateSubscriptionStatus(tenant: { subscriptionStatus: string }): void {
    const validStatuses = ['TRIAL', 'ACTIVE'];

    if (!validStatuses.includes(tenant.subscriptionStatus)) {
      throw new ForbiddenException({
        code: SubscriptionErrorCode.SUBSCRIPTION_EXPIRED,
        status: tenant.subscriptionStatus,
        message: 'Your subscription has expired. Please upgrade to continue.',
      });
    }
  }

  private validateTrialExpiry(tenant: { subscriptionStatus: string; trialEndsAt: Date | null }): void {
    const isTrialExpired =
      tenant.subscriptionStatus === 'TRIAL' &&
      tenant.trialEndsAt &&
      tenant.trialEndsAt < new Date();

    if (isTrialExpired) {
      throw new ForbiddenException({
        code: SubscriptionErrorCode.TRIAL_EXPIRED,
        message: 'Your trial period has ended. Please subscribe to continue.',
      });
    }
  }
}
