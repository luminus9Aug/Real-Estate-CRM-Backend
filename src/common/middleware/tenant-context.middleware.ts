import { Injectable, InternalServerErrorException, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole } from '../constants/roles.constants';

/**
 * Sets RLS session when user was attached earlier in the chain.
 * SuperAdmins bypass tenant context.
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const start = Date.now();
    console.log(`[DEBUG] TenantContextMiddleware start for ${req.url}`);
    try {
      const user = req.user;
      const tenantId = user?.tenantId;
      
      // SuperAdmins bypass tenant context for global access
      if (user?.role === UserRole.SUPER_ADMIN) {
        return next();
      }

      // Tenant isolation is handled dynamically by TenantPrismaService extensions
      next();
    } finally {
      console.log(`[DEBUG] TenantContextMiddleware took ${Date.now() - start}ms`);
    }
  }
}
