import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { CommissionStatus, CommissionType, UserRole } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { CommissionTransactionRepository } from './commission-transaction.repository';
import { AuthUser } from '../auth/types/auth-user.type';
import { formatCurrencyAmount } from '../../common/utils/format-currency.util';
import { MessageGateway } from '../../gateways/message.gateway';
import { Inject } from '@nestjs/common';
import type Redis from 'ioredis';
import { CACHE_KEYS } from '../../common/constants/app.constants';
import { REDIS } from '../../redis/redis.module';
import { PayCommissionDto } from './dto/pay-commission.dto';
import { CommissionCalculator, AgentForCommission } from '../../common/utils/commission-calculator.util';

@Injectable()
export class CommissionService {
  constructor(
    private readonly commissionRepo: CommissionTransactionRepository,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly gateway: MessageGateway,
    private readonly i18n: I18nService,
  ) {}

  // calculateCommission is now imported from common/utils

  async listPending(user: AuthUser): Promise<unknown[]> {
    const cacheKey = CACHE_KEYS.commissionPending(user.tenantId ?? 'global');
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const items = await this.commissionRepo.findMany(user, {
      where: { status: CommissionStatus.PENDING, voidedAt: null },
      orderBy: { calculatedAt: 'desc' },
    });

    await this.redis.set(cacheKey, JSON.stringify(items), 'EX', 60);
    return items;
  }

  async listMy(user: AuthUser): Promise<unknown[]> {
    return this.commissionRepo.findMany(user, {
      where: { agentId: user.id, voidedAt: null },
      orderBy: { calculatedAt: 'desc' },
    });
  }

  async listForAgent(
    user: AuthUser,
    agentId: string,
  ): Promise<unknown[]> {
    if (user.role === UserRole.VIEWER) {
      throw new ForbiddenException();
    }
    if (user.role === UserRole.AGENT && agentId !== user.id) {
      throw new ForbiddenException();
    }
    return this.commissionRepo.findMany(user, {
      where: { agentId, voidedAt: null },
      orderBy: { calculatedAt: 'desc' },
    });
  }

  async payCommission(
    user: AuthUser,
    commissionTxId: string,
    dto: PayCommissionDto,
  ): Promise<unknown> {
    const updated = await this.commissionRepo['prisma'].$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string; amount: unknown }>>`
        SELECT id, amount
        FROM commission_transactions
        WHERE id = ${commissionTxId}
          AND tenant_id = ${user.tenantId}
          AND status = 'PENDING'
          AND voided_at IS NULL
        FOR UPDATE NOWAIT
      `;

      if (!locked.length) {
        throw new BadRequestException(this.i18n.t('commission.already_paid_or_not_found'));
      }

      return this.commissionRepo.update(user, {
        where: { id: locked[0].id },
        data: {
          status: CommissionStatus.PAID,
          paidAt: new Date(),
          paymentReference: dto.paymentReference ?? null,
          notes: dto.notes ?? null,
        },
        include: { lead: true },
      }, tx);
    });

    const row = updated as {
      id: string;
      amount: { toString(): string };
      currency: string;
    };

    const amountNum = Number(row.amount.toString());
    if (user.tenantId) {
      this.gateway.emitCommissionPaid(user.tenantId, {
        commissionId: row.id,
        amount: amountNum,
        currency: row.currency,
        amountFormatted: formatCurrencyAmount(amountNum, row.currency),
      });

      await this.redis.del(CACHE_KEYS.commissionPending(user.tenantId));
      await this.redis.del(CACHE_KEYS.dashboardStats(user.tenantId));
    }

    return updated;
  }
}
