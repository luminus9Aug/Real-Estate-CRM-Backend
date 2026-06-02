import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Ensures route params or body tenantId (if present) matches authenticated user's tenant.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const start = Date.now();
    try {
      const request = context.switchToHttp().getRequest<Request>();
      const user = request.user;
      if (!user) {
        return true;
      }
      const body = request.body as { tenantId?: string } | undefined;
      const paramTenant = (request.params as { tenantId?: string }).tenantId;
      const candidate = body?.tenantId ?? paramTenant;
      if (candidate && candidate !== user.tenantId) {
        throw new ForbiddenException('Tenant mismatch');
      }
      return true;
    } finally {
      console.log(`[DEBUG] TenantGuard took ${Date.now() - start}ms`);
    }
  }
}
