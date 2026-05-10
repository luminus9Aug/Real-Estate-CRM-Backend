import { Inject, Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import type { Request } from 'express';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TENANT_SCOPED_MODELS } from '../constants/app.constants';

@Injectable({ scope: Scope.REQUEST })
export class TenantPrismaService {
  public readonly client: PrismaClient;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REQUEST) private readonly req: Request,
  ) {
    const user = this.req.user;
    const tenantId = user?.tenantId;

    this.client = this.prisma.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            const modelName = (model ?? '').toLowerCase();
            const isTenantModel = (TENANT_SCOPED_MODELS as readonly string[]).includes(modelName);

            if (!isTenantModel || !tenantId) {
              return query(args);
            }

            const writeOps = ['create', 'createMany', 'upsert'];
            const readOps = ['findMany', 'findFirst', 'findUnique', 'count', 'aggregate', 'groupBy'];
            const mutateOps = ['update', 'updateMany', 'delete', 'deleteMany'];

            let nextArgs = args;

            if (readOps.includes(operation) || mutateOps.includes(operation)) {
              const prevWhere = (args as { where?: Record<string, unknown> }).where ?? {};
              nextArgs = {
                ...args,
                where: { ...prevWhere, tenantId },
              };
            }

            if (writeOps.includes(operation) && operation === 'create') {
              const a = args as { data: Record<string, unknown> };
              nextArgs = {
                ...args,
                data: {
                  ...a.data,
                  tenantId,
                },
              };
            }

            return query(nextArgs);
          },
        },
      },
    }) as unknown as PrismaClient;
  }
}
