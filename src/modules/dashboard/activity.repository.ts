import { Injectable } from '@nestjs/common';
import { Prisma, Activity } from '@prisma/client';
import { BaseRepository } from '../../common/repository/base.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../auth/types/auth-user.type';

@Injectable()
export class ActivityRepository extends BaseRepository {
  constructor(protected readonly prismaService: PrismaService) {
    super(prismaService, 'activity');
  }

  async findMany(user: AuthUser, args: Prisma.ActivityFindManyArgs = {}, tx?: Prisma.TransactionClient): Promise<Activity[]> {
    return super.findMany(user, args, tx);
  }

  async findFirst(user: AuthUser, args: Prisma.ActivityFindFirstArgs = {}, tx?: Prisma.TransactionClient): Promise<Activity | null> {
    return super.findFirst(user, args, tx);
  }

  async findUnique(user: AuthUser, args: Prisma.ActivityFindUniqueArgs, tx?: Prisma.TransactionClient): Promise<Activity | null> {
    return super.findUnique(user, args, tx);
  }

  async create(user: AuthUser, args: Prisma.ActivityCreateArgs, tx?: Prisma.TransactionClient): Promise<Activity> {
    return super.create(user, args, tx);
  }

  async update(user: AuthUser, args: Prisma.ActivityUpdateArgs, tx?: Prisma.TransactionClient): Promise<Activity> {
    return super.update(user, args, tx);
  }

  async count(user: AuthUser, args: Prisma.ActivityCountArgs = {}, tx?: Prisma.TransactionClient): Promise<number> {
    return super.count(user, args, tx);
  }
}
