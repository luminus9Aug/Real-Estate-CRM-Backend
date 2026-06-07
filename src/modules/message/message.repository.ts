import { Injectable } from '@nestjs/common';
import { Prisma, Message } from '@prisma/client';
import { BaseRepository } from '../../common/repository/base.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../auth/types/auth-user.type';

@Injectable()
export class MessageRepository extends BaseRepository {
  constructor(protected readonly prismaService: PrismaService) {
    super(prismaService, 'message');
  }

  async findMany(user: AuthUser, args: Prisma.MessageFindManyArgs = {}, tx?: Prisma.TransactionClient): Promise<Message[]> {
    return super.findMany(user, args, tx);
  }

  async findFirst(user: AuthUser, args: Prisma.MessageFindFirstArgs = {}, tx?: Prisma.TransactionClient): Promise<Message | null> {
    return super.findFirst(user, args, tx);
  }

  async findUnique(user: AuthUser, args: Prisma.MessageFindUniqueArgs, tx?: Prisma.TransactionClient): Promise<Message | null> {
    return super.findUnique(user, args, tx);
  }

  async create(user: AuthUser, args: Prisma.MessageCreateArgs, tx?: Prisma.TransactionClient): Promise<Message> {
    return super.create(user, args, tx);
  }

  async update(user: AuthUser, args: Prisma.MessageUpdateArgs, tx?: Prisma.TransactionClient): Promise<Message> {
    return super.update(user, args, tx);
  }

  async count(user: AuthUser, args: Prisma.MessageCountArgs = {}, tx?: Prisma.TransactionClient): Promise<number> {
    return super.count(user, args, tx);
  }
}
