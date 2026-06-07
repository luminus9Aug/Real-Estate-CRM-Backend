import { Injectable } from '@nestjs/common';
import { Prisma, BrochureLink } from '@prisma/client';
import { BaseRepository } from '../../common/repository/base.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../auth/types/auth-user.type';

@Injectable()
export class BrochureLinkRepository extends BaseRepository {
  constructor(protected readonly prismaService: PrismaService) {
    super(prismaService, 'brochureLink');
  }

  async findMany(user: AuthUser, args: Prisma.BrochureLinkFindManyArgs = {}, tx?: Prisma.TransactionClient): Promise<BrochureLink[]> {
    return super.findMany(user, args, tx);
  }

  async findFirst(user: AuthUser, args: Prisma.BrochureLinkFindFirstArgs = {}, tx?: Prisma.TransactionClient): Promise<BrochureLink | null> {
    return super.findFirst(user, args, tx);
  }

  async findUnique(user: AuthUser, args: Prisma.BrochureLinkFindUniqueArgs, tx?: Prisma.TransactionClient): Promise<BrochureLink | null> {
    return super.findUnique(user, args, tx);
  }

  async create(user: AuthUser, args: Prisma.BrochureLinkCreateArgs, tx?: Prisma.TransactionClient): Promise<BrochureLink> {
    return super.create(user, args, tx);
  }

  async update(user: AuthUser, args: Prisma.BrochureLinkUpdateArgs, tx?: Prisma.TransactionClient): Promise<BrochureLink> {
    return super.update(user, args, tx);
  }

  async count(user: AuthUser, args: Prisma.BrochureLinkCountArgs = {}, tx?: Prisma.TransactionClient): Promise<number> {
    return super.count(user, args, tx);
  }
}
