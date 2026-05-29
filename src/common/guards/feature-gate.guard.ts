import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FEATURE_KEY_METADATA } from '../decorators/require-feature.decorator';
import { FeatureKey } from '../constants/features.constants';
import { UserRole } from '../constants/roles.constants';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FeatureGateGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const featureKey = this.reflector.get<FeatureKey>(
      FEATURE_KEY_METADATA,
      context.getHandler(),
    );

    if (!featureKey) {
      return true; // No feature gate
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // SuperAdmins bypass all feature gates
    if (user?.role === UserRole.SUPER_ADMIN) {
      return true;
    }

    if (!user?.tenantId) {
      throw new ForbiddenException('Tenant context required');
    }

    const isEnabled = await this.checkFeatureEnabled(user.tenantId, featureKey);

    if (!isEnabled) {
      throw new ForbiddenException(
        `Feature "${featureKey}" is not available in your plan. Please upgrade.`
      );
    }

    return true;
  }

  private async checkFeatureEnabled(
    tenantId: string,
    featureKey: FeatureKey,
  ): Promise<boolean> {
    const cacheKey = `features:${tenantId}`;
    
    let features = await this.cacheManager.get<Record<string, boolean>>(cacheKey);
    
    if (!features) {
      features = await this.buildFeatureMatrix(tenantId);
      await this.cacheManager.set(cacheKey, features, 300000); // 5 min TTL
    }

    return features[featureKey] ?? false;
  }

  private async buildFeatureMatrix(tenantId: string): Promise<Record<string, boolean>> {
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

    const matrix: Record<string, boolean> = {};
    
    for (const feature of tenant.currentPlan.features) {
      matrix[feature.featureKey] = feature.isEnabled;
    }

    return matrix;
  }
}
