import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../modules/auth/types/auth-user.type';
import { UserRole } from '../constants/roles.constants';

/**
 * Base Repository for all tenant-scoped entities.
 * Automatically enforces tenant isolation based on the AuthUser context.
 */
@Injectable()
export abstract class BaseRepository {
  constructor(
    protected readonly prisma: PrismaService,
    protected readonly modelName: string
  ) {}

  protected getDelegate(tx?: any) {
    return (tx || this.prisma)[this.modelName];
  }

  protected getTenantWhere(user: AuthUser, argsWhere: any = {}): any {
    if (user.role === UserRole.SUPER_ADMIN) {
      return argsWhere;
    }
    if (!user.tenantId) {
      throw new Error('Tenant context missing for database operation');
    }
    return { ...argsWhere, tenantId: user.tenantId };
  }

  protected getTenantData(user: AuthUser, argsData: any = {}): any {
    if (user.role === UserRole.SUPER_ADMIN) {
      return argsData;
    }
    if (!user.tenantId) {
      throw new Error('Tenant context missing for database operation');
    }
    return { ...argsData, tenantId: user.tenantId };
  }

  async findMany(user: AuthUser, args: any = {}, tx?: any): Promise<any> {
    const where = this.getTenantWhere(user, args.where);
    return this.getDelegate(tx).findMany({ ...args, where });
  }

  async findFirst(user: AuthUser, args: any = {}, tx?: any): Promise<any> {
    const where = this.getTenantWhere(user, args.where);
    return this.getDelegate(tx).findFirst({ ...args, where });
  }

  /**
   * findUnique enforced via findFirst because adding tenantId to where 
   * breaks Prisma's unique compound constraints if tenantId is not part of the unique key.
   */
  async findUnique(user: AuthUser, args: any, tx?: any): Promise<any> {
    const where = this.getTenantWhere(user, args.where);
    return this.getDelegate(tx).findFirst({ ...args, where });
  }

  async count(user: AuthUser, args: any = {}, tx?: any): Promise<number> {
    const where = this.getTenantWhere(user, args.where);
    return this.getDelegate(tx).count({ ...args, where });
  }

  async groupBy(user: AuthUser, args: any, tx?: any): Promise<any> {
    const where = this.getTenantWhere(user, args.where);
    return this.getDelegate(tx).groupBy({ ...args, where });
  }

  async aggregate(user: AuthUser, args: any, tx?: any): Promise<any> {
    const where = this.getTenantWhere(user, args.where);
    return this.getDelegate(tx).aggregate({ ...args, where });
  }

  async create(user: AuthUser, args: any, tx?: any): Promise<any> {
    const data = this.getTenantData(user, args.data);
    return this.getDelegate(tx).create({ ...args, data });
  }

  async update(user: AuthUser, args: any, tx?: any): Promise<any> {
    // Ensure security by verifying the record belongs to the tenant
    if (user.role !== UserRole.SUPER_ADMIN) {
      const record = await this.getDelegate(tx).findFirst({
        where: { ...args.where, tenantId: user.tenantId },
        select: { id: true }
      });
      if (!record) throw new Error('Record not found or unauthorized');
    }
    return this.getDelegate(tx).update(args);
  }

  async softDelete(user: AuthUser, args: any, tx?: any): Promise<any> {
    if (user.role !== UserRole.SUPER_ADMIN) {
      const record = await this.getDelegate(tx).findFirst({
        where: { ...args.where, tenantId: user.tenantId },
        select: { id: true }
      });
      if (!record) throw new Error('Record not found or unauthorized');
    }
    return this.getDelegate(tx).update({
      ...args,
      data: { ...args.data, deletedAt: new Date() }
    });
  }

  async delete(user: AuthUser, args: any, tx?: any): Promise<any> {
    if (user.role !== UserRole.SUPER_ADMIN) {
      const record = await this.getDelegate(tx).findFirst({
        where: { ...args.where, tenantId: user.tenantId },
        select: { id: true }
      });
      if (!record) throw new Error('Record not found or unauthorized');
    }
    return this.getDelegate(tx).delete(args);
  }
}
