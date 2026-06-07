import { Injectable } from '@nestjs/common';
import { Prisma, FollowUp } from '@prisma/client';
import { BaseRepository } from '../../common/repository/base.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../auth/types/auth-user.type';

@Injectable()
export class FollowUpRepository extends BaseRepository {
  constructor(protected readonly prismaService: PrismaService) {
    super(prismaService, 'followUp');
  }

  async findMany(user: AuthUser, args: Prisma.FollowUpFindManyArgs = {}, tx?: Prisma.TransactionClient): Promise<FollowUp[]> {
    return super.findMany(user, args, tx);
  }

  async findFirst(user: AuthUser, args: Prisma.FollowUpFindFirstArgs = {}, tx?: Prisma.TransactionClient): Promise<FollowUp | null> {
    return super.findFirst(user, args, tx);
  }

  async findUnique(user: AuthUser, args: Prisma.FollowUpFindUniqueArgs, tx?: Prisma.TransactionClient): Promise<FollowUp | null> {
    return super.findUnique(user, args, tx);
  }

  async create(user: AuthUser, args: Prisma.FollowUpCreateArgs, tx?: Prisma.TransactionClient): Promise<FollowUp> {
    return super.create(user, args, tx);
  }

  async update(user: AuthUser, args: Prisma.FollowUpUpdateArgs, tx?: Prisma.TransactionClient): Promise<FollowUp> {
    return super.update(user, args, tx);
  }

  async count(user: AuthUser, args: Prisma.FollowUpCountArgs = {}, tx?: Prisma.TransactionClient): Promise<number> {
    return super.count(user, args, tx);
  }
}
