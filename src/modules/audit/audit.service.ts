import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(data: {
    tenantId?: string;
    userId?: string;
    action: string;
    entity: string;
    entityId: string;
    details?: Record<string, unknown>;
    ipAddress?: string;
  }) {
    return this.prisma.auditLog.create({
      data: {
        tenantId: data.tenantId,
        userId: data.userId,
        action: data.action,
        entity: data.entity,
        entityId: data.entityId,
        metadata: data.details as unknown as import('@prisma/client').Prisma.InputJsonValue, // Prisma Json field accepts InputJsonValue
        ipAddress: data.ipAddress,
      },
    });
  }
}
