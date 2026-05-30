import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole } from '../constants/roles.constants';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class SubscriptionActiveGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return true; // Let JwtAuthGuard handle unauthenticated access
    }

    // SuperAdmins bypass subscription checks
    if (user.role === UserRole.SUPER_ADMIN) {
      return true;
    }

    if (!user?.tenantId) {
      throw new ForbiddenException('Tenant context required');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { subscriptionStatus: true, trialEndsAt: true },
    });

    if (!tenant) {
      throw new ForbiddenException('Tenant not found');
    }

    const validStatuses = ['TRIAL', 'ACTIVE'];
    if (!validStatuses.includes(tenant.subscriptionStatus)) {
      throw new ForbiddenException(
        'Subscription expired. Please upgrade to continue using the service.'
      );
    }

    // Check trial expiry
    if (
      tenant.subscriptionStatus === 'TRIAL' &&
      tenant.trialEndsAt &&
      tenant.trialEndsAt < new Date()
    ) {
      throw new ForbiddenException('Trial period has ended. Please subscribe to continue.');
    }

    return true;
  }
}
