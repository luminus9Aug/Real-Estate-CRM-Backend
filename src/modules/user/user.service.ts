import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import type Redis from 'ioredis';
import { I18nService } from 'nestjs-i18n';
import { TenantPrismaService } from '../../common/utils/tenant-prisma.service';
import { CACHE_KEYS } from '../../common/constants/app.constants';
import { REDIS } from '../../redis/redis.module';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateLanguageDto } from './dto/update-language.dto';
import { Gender } from '@prisma/client';
import { AvatarGenerator } from '../../common/utils/avatar-generator.util';
import { QuotaCounterService } from '../../common/utils/quota-counter.service';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class UserService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly i18n: I18nService,
    private readonly quotaCounter: QuotaCounterService,
  ) {}

  async list(tenantId: string): Promise<Record<string, unknown>[]> {
    const users = await this.tenantPrisma.client.user.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return users.map((u) => this.strip(u));
  }

  async findOne(id: string, tenantId?: string): Promise<Record<string, unknown>> {
    const tId = tenantId || (await this.tenantPrisma.client.user.findUnique({ where: { id }, select: { tenantId: true } }))?.tenantId;
    if (!tId) throw new NotFoundException(this.i18n.t('users.user_not_found'));

    const cacheKey = CACHE_KEYS.user(tId, id);
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const user = await this.tenantPrisma.client.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!user) throw new NotFoundException(this.i18n.t('users.user_not_found'));

    const result = this.strip(user);
    await this.redis.set(cacheKey, JSON.stringify(result), 'EX', 300);
    return result;
  }

  async create(tenantId: string, dto: CreateUserDto): Promise<Record<string, unknown>> {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    try {
      const user = await this.tenantPrisma.client.user.create({
        data: {
          tenantId,
          email: dto.email,
          name: dto.name,
          phone: dto.phone,
          role: dto.role,
          gender: dto.gender || Gender.MALE,
          passwordHash,
          avatarUrl: dto.avatarUrl || AvatarGenerator.generate(dto.gender || Gender.MALE, dto.role),
          birthday: dto.birthday,
          anniversary: dto.anniversary,
          isActive: dto.isActive ?? true,
          commissionType: dto.commissionType,
          commissionRate: dto.commissionRate,
          fixedCommissionAmount: dto.fixedCommissionAmount,
        },
      });
      if (user.role === UserRole.AGENT || user.role === UserRole.MANAGER) {
        await this.quotaCounter.increment(tenantId, 'MAX_AGENTS');
      }
      return this.strip(user);
    } catch {
      throw new ConflictException(this.i18n.t('users.email_exists'));
    }
  }

  async update(id: string, dto: UpdateUserDto): Promise<Record<string, unknown>> {
    const existing = await this.tenantPrisma.client.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('User not found');

    const data: Partial<UpdateUserDto> & { passwordHash?: string } = { ...dto };
    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
      delete data.password;
    }

    const user = await this.tenantPrisma.client.user.update({
      where: { id },
      data,
    });
    if (existing.tenantId) {
      await this.invalidateUserCache(existing.tenantId, id);
    }
    return this.strip(user);
  }

  async softDelete(id: string): Promise<Record<string, unknown>> {
    const existing = await this.tenantPrisma.client.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('User not found');

    const user = await this.tenantPrisma.client.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    if (existing.tenantId) {
      await this.invalidateUserCache(existing.tenantId, id);
      if (user.role === UserRole.AGENT || user.role === UserRole.MANAGER) {
        await this.quotaCounter.decrement(existing.tenantId, 'MAX_AGENTS');
      }
    }
    return this.strip(user);
  }

  async updateLanguage(userId: string, dto: UpdateLanguageDto): Promise<Record<string, unknown>> {
    const user = await this.tenantPrisma.client.user.update({
      where: { id: userId },
      data: { language: dto.language },
    });
    if (user.tenantId) {
      await this.invalidateUserCache(user.tenantId, userId);
    }
    return this.strip(user);
  }

  async countActiveAgents(): Promise<number> {
    return this.tenantPrisma.client.user.count({
      where: {
        role: { in: [UserRole.AGENT, UserRole.MANAGER] },
        deletedAt: null,
        isActive: true,
      },
    });
  }

  private async invalidateUserCache(tenantId: string, userId: string): Promise<void> {
    await this.redis.del(CACHE_KEYS.user(tenantId, userId));
    await this.redis.del(CACHE_KEYS.dashboardStats(tenantId));
  }

  private strip(user: { passwordHash: string; [k: string]: unknown }): Record<string, unknown> {
    const { passwordHash: _p, ...rest } = user;
    return rest;
  }
}
