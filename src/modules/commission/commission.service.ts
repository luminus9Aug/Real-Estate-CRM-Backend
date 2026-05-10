import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { CommissionStatus, CommissionType, UserRole } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { TenantPrismaService } from '../../common/utils/tenant-prisma.service';
import { formatCurrencyAmount } from '../../common/utils/format-currency.util';
import { MessageGateway } from '../../gateways/message.gateway';
import { Inject } from '@nestjs/common';
import type Redis from 'ioredis';
import { CACHE_KEYS } from '../../common/constants/app.constants';
import { REDIS } from '../../redis/redis.module';
import { PayCommissionDto } from './dto/pay-commission.dto';
import { calculateCommission } from '../../common/utils/commission-calculator.util';
import { AgentForCommission } from '../../common/utils/commission-calculator.util';

@Injectable()
export class CommissionService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly gateway: MessageGateway,
    private readonly i18n: I18nService,
  ) {}

  // calculateCommission is now imported from common/utils

  async listPending(tenantId: string): Promise<unknown[]> {
    const cacheKey = CACHE_KEYS.commissionPending(tenantId);
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const items = await this.tenantPrisma.client.commissionTransaction.findMany({
      where: { status: CommissionStatus.PENDING, voidedAt: null },
      orderBy: { calculatedAt: 'desc' },
    });

    await this.redis.set(cacheKey, JSON.stringify(items), 'EX', 60);
    return items;
  }

  async listMy(userId: string): Promise<unknown[]> {
    return this.tenantPrisma.client.commissionTransaction.findMany({
      where: { agentId: userId, voidedAt: null },
      orderBy: { calculatedAt: 'desc' },
    });
  }

  async listForAgent(
    agentId: string,
    viewerId: string,
    viewerRole: UserRole,
  ): Promise<unknown[]> {
    if (viewerRole === UserRole.VIEWER) {
      throw new ForbiddenException();
    }
    if (viewerRole === UserRole.AGENT && agentId !== viewerId) {
      throw new ForbiddenException();
    }
    return this.tenantPrisma.client.commissionTransaction.findMany({
      where: { agentId, voidedAt: null },
      orderBy: { calculatedAt: 'desc' },
    });
  }

  async payCommission(
    commissionTxId: string,
    tenantId: string,
    _payingUserId: string,
    dto: PayCommissionDto,
  ): Promise<unknown> {
    const updated = await this.tenantPrisma.client.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string; amount: unknown }>>`
        SELECT id, amount
        FROM commission_transactions
        WHERE id = ${commissionTxId}
          AND tenant_id = ${tenantId}
          AND status = 'PENDING'
          AND voided_at IS NULL
        FOR UPDATE NOWAIT
      `;

      if (!locked.length) {
        throw new BadRequestException(this.i18n.t('commission.already_paid_or_not_found'));
      }

      return tx.commissionTransaction.update({
        where: { id: locked[0].id },
        data: {
          status: CommissionStatus.PAID,
          paidAt: new Date(),
          paymentReference: dto.paymentReference ?? null,
          notes: dto.notes ?? null,
        },
        include: { lead: true },
      });
    });

    const row = updated as {
      id: string;
      amount: { toString(): string };
      currency: string;
    };

    const amountNum = Number(row.amount.toString());
    this.gateway.emitCommissionPaid(tenantId, {
      commissionId: row.id,
      amount: amountNum,
      currency: row.currency,
      amountFormatted: formatCurrencyAmount(amountNum, row.currency),
    });

    await this.redis.del(CACHE_KEYS.commissionPending(tenantId));
    await this.redis.del(CACHE_KEYS.dashboardStats(tenantId));

    return updated;
  }
}
