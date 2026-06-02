import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FEATURE_KEY_METADATA } from '../decorators/require-feature.decorator';
import { FeatureKey } from '../constants/features.constants';
import { UserRole } from '../constants/roles.constants';
import { PrismaService } from '../../prisma/prisma.service';
import type Redis from 'ioredis';
import { REDIS } from '../../redis/redis.module';
import { CACHE_KEYS } from '../constants/app.constants';

/** Structured error code the frontend can match on. */
export const PLAN_LIMIT_ERROR_CODE = 'PLAN_LIMIT_REACHED';

const FEATURE_CACHE_TTL_SEC = 3600; // 1 hour

@Injectable()
export class FeatureGateGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const start = Date.now();
    try {
      const featureKey = this.reflector.get<FeatureKey>(
        FEATURE_KEY_METADATA,
        context.getHandler(),
      );

      if (!featureKey) {
        return true;
      }

      const user = context.switchToHttp().getRequest().user;

      if (user?.role === UserRole.SUPER_ADMIN) {
        return true;
      }

      if (!user?.tenantId) {
        throw new ForbiddenException('Tenant context required');
      }

      const isEnabled = await this.checkFeatureEnabled(user.tenantId, featureKey);

      if (!isEnabled) {
        throw new ForbiddenException({
          code: PLAN_LIMIT_ERROR_CODE,
          featureKey,
          message: `Feature "${featureKey}" is not available in your plan. Please upgrade.`,
        });
      }

      return true;
    } finally {
      console.log(`[DEBUG] FeatureGateGuard took ${Date.now() - start}ms`);
    }
  }

  private async checkFeatureEnabled(
    tenantId: string,
    featureKey: FeatureKey,
  ): Promise<boolean> {
    const cacheKey = CACHE_KEYS.features(tenantId);
    
    const cached = await this.redis.get(cacheKey);
    let features: Record<string, { isEnabled: boolean; limit: number | null }> | null = null;
    
    if (cached) {
      features = JSON.parse(cached);
    } else {
      features = await this.buildFeatureMatrix(tenantId);
      await this.redis.setex(cacheKey, FEATURE_CACHE_TTL_SEC, JSON.stringify(features));
    }

    return features?.[featureKey]?.isEnabled ?? false;
  }

  private async buildFeatureMatrix(
    tenantId: string,
  ): Promise<Record<string, { isEnabled: boolean; limit: number | null }>> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        currentPlan: {
          include: {
            features: true,
          },
        },
      },
    });

    if (!tenant?.currentPlan) {
      return {};
    }

    const matrix: Record<string, { isEnabled: boolean; limit: number | null }> = {};
    
    for (const feature of tenant.currentPlan.features) {
      matrix[feature.featureKey] = {
        isEnabled: feature.isEnabled,
        limit: feature.limit,
      };
    }

    return matrix;
  }
}
