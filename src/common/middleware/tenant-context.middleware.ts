import { Injectable, InternalServerErrorException, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Optional: sets RLS session when user was attached earlier in the chain.
 * Primary tenant context is set in JwtStrategy after JWT verification.
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const tenantId = req.user?.tenantId;
    if (tenantId) {
      try {
        await this.prisma.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}::text, false)`;
      } catch {
        throw new InternalServerErrorException('Failed to set tenant context');
      }
    }
    next();
  }
}
