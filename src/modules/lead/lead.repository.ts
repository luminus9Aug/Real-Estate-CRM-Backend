import { Injectable } from '@nestjs/common';
import { Prisma, Lead } from '@prisma/client';
import { BaseRepository } from '../../common/repository/base.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../auth/types/auth-user.type';
import { UserRole } from '../../common/constants/roles.constants';

@Injectable()
export class LeadRepository extends BaseRepository {
  constructor(protected readonly prismaService: PrismaService) {
    super(prismaService, 'lead');
  }

  private buildAgentScopeWhere(
    user: AuthUser,
    where: Prisma.LeadWhereInput = {},
  ): Prisma.LeadWhereInput {
    const RESTRICTED_ROLES: UserRole[] = [UserRole.AGENT, UserRole.VIEWER];
    const isRestricted = RESTRICTED_ROLES.includes(user.role as UserRole)
      && !user.hasFullDataAccess;

    return isRestricted
      ? { ...where, assignedToId: user.id }
      : where;
  }

  async findMany(user: AuthUser, args: Prisma.LeadFindManyArgs = {}, tx?: Prisma.TransactionClient): Promise<Lead[]> {
    const scopedWhere = this.buildAgentScopeWhere(user, args.where);
    return super.findMany(user, { ...args, where: scopedWhere }, tx);
  }

  async findFirst(user: AuthUser, args: Prisma.LeadFindFirstArgs = {}, tx?: Prisma.TransactionClient): Promise<Lead | null> {
    const scopedWhere = this.buildAgentScopeWhere(user, args.where);
    return super.findFirst(user, { ...args, where: scopedWhere }, tx);
  }

  async findUnique(user: AuthUser, args: Prisma.LeadFindUniqueArgs, tx?: Prisma.TransactionClient): Promise<Lead | null> {
    const scopedWhere = this.buildAgentScopeWhere(user, args.where as any);
    return super.findUnique(user, { ...args, where: scopedWhere }, tx);
  }

  async create(user: AuthUser, args: Prisma.LeadCreateArgs, tx?: Prisma.TransactionClient): Promise<Lead> {
    return super.create(user, args, tx);
  }

  async update(user: AuthUser, args: Prisma.LeadUpdateArgs, tx?: Prisma.TransactionClient): Promise<Lead> {
    return super.update(user, args, tx);
  }

  async softDelete(user: AuthUser, args: Prisma.LeadUpdateArgs, tx?: Prisma.TransactionClient): Promise<Lead> {
    return super.softDelete(user, args, tx);
  }

  async getAgentLeadStats(user: AuthUser): Promise<any[]> {
    if (!user.tenantId) throw new Error('Tenant ID required');
    return this.prismaService.$queryRaw`
      SELECT
        assigned_to_id AS "assignedToId",
        status::text AS "status",
        COUNT(*)::int AS "count"
      FROM leads
      WHERE tenant_id = ${user.tenantId} AND deleted_at IS NULL
      GROUP BY assigned_to_id, status
      ORDER BY assigned_to_id ASC NULLS LAST, status ASC
    `;
  }

  async count(user: AuthUser, args: Prisma.LeadCountArgs = {}, tx?: Prisma.TransactionClient): Promise<number> {
    const scopedWhere = this.buildAgentScopeWhere(user, args.where);
    return super.count(user, { ...args, where: scopedWhere }, tx);
  }
}
