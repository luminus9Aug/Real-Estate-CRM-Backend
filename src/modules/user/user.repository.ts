import { Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { BaseRepository } from '../../common/repository/base.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../auth/types/auth-user.type';

@Injectable()
export class UserRepository extends BaseRepository {
  constructor(protected readonly prismaService: PrismaService) {
    super(prismaService, 'user');
  }

  async findMany(user: AuthUser, args: Prisma.UserFindManyArgs = {}, tx?: Prisma.TransactionClient): Promise<User[]> {
    return super.findMany(user, args, tx);
  }

  async findFirst(user: AuthUser, args: Prisma.UserFindFirstArgs = {}, tx?: Prisma.TransactionClient): Promise<User | null> {
    return super.findFirst(user, args, tx);
  }

  async findUnique(user: AuthUser, args: Prisma.UserFindUniqueArgs, tx?: Prisma.TransactionClient): Promise<User | null> {
    return super.findUnique(user, args, tx);
  }

  async create(user: AuthUser, args: Prisma.UserCreateArgs, tx?: Prisma.TransactionClient): Promise<User> {
    return super.create(user, args, tx);
  }

  async update(user: AuthUser, args: Prisma.UserUpdateArgs, tx?: Prisma.TransactionClient): Promise<User> {
    return super.update(user, args, tx);
  }

  async softDelete(user: AuthUser, args: Prisma.UserUpdateArgs, tx?: Prisma.TransactionClient): Promise<User> {
    return super.softDelete(user, args, tx);
  }

  async count(user: AuthUser, args: Prisma.UserCountArgs = {}, tx?: Prisma.TransactionClient): Promise<number> {
    return super.count(user, args, tx);
  }
}
