import { Injectable } from '@nestjs/common';
import { Prisma, Property } from '@prisma/client';
import { BaseRepository } from '../../common/repository/base.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../auth/types/auth-user.type';
import { UserRole } from '../../common/constants/roles.constants';

@Injectable()
export class PropertyRepository extends BaseRepository {
  constructor(protected readonly prismaService: PrismaService) {
    super(prismaService, 'property');
  }

  private buildAgentScopeWhere(
    user: AuthUser,
    where: Prisma.PropertyWhereInput = {},
  ): Prisma.PropertyWhereInput {
    const RESTRICTED_ROLES: UserRole[] = [UserRole.AGENT, UserRole.VIEWER];
    const isRestricted = RESTRICTED_ROLES.includes(user.role as UserRole)
      && !user.hasFullDataAccess;

    return isRestricted
      ? { ...where, assignedToId: user.id }
      : where;
  }

  async findMany(user: AuthUser, args: Prisma.PropertyFindManyArgs = {}, tx?: Prisma.TransactionClient): Promise<Property[]> {
    const scopedWhere = this.buildAgentScopeWhere(user, args.where);
    return super.findMany(user, { ...args, where: scopedWhere }, tx);
  }

  async findFirst(user: AuthUser, args: Prisma.PropertyFindFirstArgs = {}, tx?: Prisma.TransactionClient): Promise<Property | null> {
    const scopedWhere = this.buildAgentScopeWhere(user, args.where);
    return super.findFirst(user, { ...args, where: scopedWhere }, tx);
  }

  async findUnique(user: AuthUser, args: Prisma.PropertyFindUniqueArgs, tx?: Prisma.TransactionClient): Promise<Property | null> {
    const scopedWhere = this.buildAgentScopeWhere(user, args.where as any);
    return super.findUnique(user, { ...args, where: scopedWhere }, tx);
  }

  async create(user: AuthUser, args: Prisma.PropertyCreateArgs, tx?: Prisma.TransactionClient): Promise<Property> {
    return super.create(user, args, tx);
  }

  async update(user: AuthUser, args: Prisma.PropertyUpdateArgs, tx?: Prisma.TransactionClient): Promise<Property> {
    return super.update(user, args, tx);
  }

  async softDelete(user: AuthUser, args: Prisma.PropertyUpdateArgs, tx?: Prisma.TransactionClient): Promise<Property> {
    return super.softDelete(user, args, tx);
  }

  async count(user: AuthUser, args: Prisma.PropertyCountArgs = {}, tx?: Prisma.TransactionClient): Promise<number> {
    const scopedWhere = this.buildAgentScopeWhere(user, args.where);
    return super.count(user, { ...args, where: scopedWhere }, tx);
  }
}
