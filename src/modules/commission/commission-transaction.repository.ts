import { Injectable } from '@nestjs/common';
import { Prisma, CommissionTransaction } from '@prisma/client';
import { BaseRepository } from '../../common/repository/base.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../auth/types/auth-user.type';

@Injectable()
export class CommissionTransactionRepository extends BaseRepository {
  constructor(protected readonly prismaService: PrismaService) {
    super(prismaService, 'commissionTransaction');
  }

  async findMany(user: AuthUser, args: Prisma.CommissionTransactionFindManyArgs = {}, tx?: Prisma.TransactionClient): Promise<CommissionTransaction[]> {
    return super.findMany(user, args, tx);
  }

  async findFirst(user: AuthUser, args: Prisma.CommissionTransactionFindFirstArgs = {}, tx?: Prisma.TransactionClient): Promise<CommissionTransaction | null> {
    return super.findFirst(user, args, tx);
  }

  async findUnique(user: AuthUser, args: Prisma.CommissionTransactionFindUniqueArgs, tx?: Prisma.TransactionClient): Promise<CommissionTransaction | null> {
    return super.findUnique(user, args, tx);
  }

  async create(user: AuthUser, args: Prisma.CommissionTransactionCreateArgs, tx?: Prisma.TransactionClient): Promise<CommissionTransaction> {
    return super.create(user, args, tx);
  }

  async update(user: AuthUser, args: Prisma.CommissionTransactionUpdateArgs, tx?: Prisma.TransactionClient): Promise<CommissionTransaction> {
    return super.update(user, args, tx);
  }

  async count(user: AuthUser, args: Prisma.CommissionTransactionCountArgs = {}, tx?: Prisma.TransactionClient): Promise<number> {
    return super.count(user, args, tx);
  }

  async getAgentCommissionStats(user: AuthUser): Promise<any[]> {
    if (!user.tenantId) throw new Error('Tenant ID required');
    return this.prismaService.$queryRaw`
      SELECT
        agent_id AS "agentId",
        status::text AS "status",
        COALESCE(SUM(amount), 0) AS "sumAmount",
        COUNT(*)::int AS "count"
      FROM commission_transactions
      WHERE tenant_id = ${user.tenantId} AND voided_at IS NULL
      GROUP BY agent_id, status
      ORDER BY agent_id ASC, status ASC
    `;
  }
}
