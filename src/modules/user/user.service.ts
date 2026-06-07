import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { UserRole } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import type Redis from "ioredis";
import { I18nService } from "nestjs-i18n";
import { UserRepository } from "./user.repository";
import { AuthUser } from "../auth/types/auth-user.type";
import { CACHE_KEYS } from "../../common/constants/app.constants";
import { REDIS } from "../../redis/redis.module";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UpdateLanguageDto } from "./dto/update-language.dto";
import { ToggleFullAccessDto } from "./dto/toggle-full-access.dto";
import { Gender } from "@prisma/client";
import { AvatarGenerator } from "../../common/utils/avatar-generator.util";
import { QuotaCounterService } from "../../common/utils/quota-counter.service";

const BCRYPT_ROUNDS = 12;

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly i18n: I18nService,
    private readonly quotaCounter: QuotaCounterService,
  ) {}

  async list(user: AuthUser): Promise<Record<string, unknown>[]> {
    const users = await this.userRepository.findMany(user, {
      where: { deletedAt: null, id: { not: user.id } },
      orderBy: { createdAt: "desc" },
    });
    return users.map((u) => this.strip(u));
  }

  async findOne(user: AuthUser, id: string): Promise<Record<string, unknown>> {
    const tId = user.tenantId;
    if (!tId) throw new NotFoundException(this.i18n.t("users.user_not_found"));

    const cacheKey = CACHE_KEYS.user(tId ?? "global", id);
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const record = await this.userRepository.findFirst(user, {
      where: { id, deletedAt: null },
    });
    if (!record)
      throw new NotFoundException(this.i18n.t("users.user_not_found"));

    const result = this.strip(record);
    await this.redis.set(cacheKey, JSON.stringify(result), "EX", 300);
    return result;
  }

  async create(
    user: AuthUser,
    dto: CreateUserDto,
  ): Promise<Record<string, unknown>> {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    try {
      const record = await this.userRepository.create(user, {
        data: {
          tenantId: user.tenantId,
          email: dto.email,
          name: dto.name,
          phone: dto.phone,
          role: dto.role,
          gender: dto.gender || Gender.MALE,
          passwordHash,
          avatarUrl:
            dto.avatarUrl ||
            AvatarGenerator.generate(dto.gender || Gender.MALE, dto.role),
          birthday: dto.birthday,
          anniversary: dto.anniversary,
          isActive: dto.isActive ?? true,
          commissionType: dto.commissionType,
          commissionRate: dto.commissionRate,
          fixedCommissionAmount: dto.fixedCommissionAmount,
        },
      });
      if (record.role === UserRole.AGENT || record.role === UserRole.MANAGER) {
        if (user.tenantId) {
          await this.quotaCounter.increment(user.tenantId, "MAX_AGENTS");
        }
      }
      return this.strip(record);
    } catch {
      throw new ConflictException(this.i18n.t("users.email_exists"));
    }
  }

  async update(
    user: AuthUser,
    id: string,
    dto: UpdateUserDto,
  ): Promise<Record<string, unknown>> {
    const existing = await this.userRepository.findFirst(user, {
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException("User not found");

    const data: Partial<UpdateUserDto> & { passwordHash?: string } = { ...dto };
    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
      delete data.password;
    }

    const record = await this.userRepository.update(user, {
      where: { id },
      data,
    });
    if (existing.tenantId) {
      await this.invalidateUserCache(existing.tenantId, id);
    }
    return this.strip(record);
  }

  async softDelete(
    user: AuthUser,
    id: string,
  ): Promise<Record<string, unknown>> {
    const existing = await this.userRepository.findFirst(user, {
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException("User not found");

    const record = await this.userRepository.softDelete(user, {
      where: { id },
      data: {},
    });
    if (existing.tenantId) {
      await this.invalidateUserCache(existing.tenantId, id);
      if (record.role === UserRole.AGENT || record.role === UserRole.MANAGER) {
        await this.quotaCounter.decrement(existing.tenantId, "MAX_AGENTS");
      }
    }
    return this.strip(record);
  }

  async updateLanguage(
    user: AuthUser,
    dto: UpdateLanguageDto,
  ): Promise<Record<string, unknown>> {
    const record = await this.userRepository.update(user, {
      where: { id: user.id },
      data: { language: dto.language },
    });
    if (record.tenantId) {
      await this.invalidateUserCache(record.tenantId, user.id);
    }
    return this.strip(record);
  }

  async countActiveAgents(user: AuthUser): Promise<number> {
    return this.userRepository.count(user, {
      where: {
        role: { in: [UserRole.AGENT, UserRole.MANAGER] },
        deletedAt: null,
        isActive: true,
      },
    });
  }

  async toggleFullAccess(
    caller: AuthUser,
    targetUserId: string,
    dto: ToggleFullAccessDto,
  ): Promise<Record<string, unknown>> {
    const target = await this.userRepository.findFirst(caller, {
      where: { id: targetUserId, deletedAt: null },
    });
    if (!target)
      throw new NotFoundException(this.i18n.t("users.user_not_found"));

    const ELEVATED_ROLES: UserRole[] = [
      UserRole.OWNER,
      UserRole.MANAGER,
      UserRole.SUPER_ADMIN,
    ];
    if (ELEVATED_ROLES.includes(target.role as UserRole)) {
      throw new BadRequestException(
        "Full access flag is only applicable to AGENT and VIEWER roles",
      );
    }

    const updated = await this.userRepository.update(caller, {
      where: { id: targetUserId },
      data: { hasFullDataAccess: dto.hasFullDataAccess },
    });

    if (target.tenantId) {
      const sessionKey = CACHE_KEYS.sessionUser(target.tenantId, targetUserId);
      await this.redis.del(sessionKey);
      await this.invalidateUserCache(target.tenantId, targetUserId);
    }

    return this.strip(updated);
  }

  private async invalidateUserCache(
    tenantId: string,
    userId: string,
  ): Promise<void> {
    await this.redis.del(CACHE_KEYS.user(tenantId, userId));
    await this.redis.del(CACHE_KEYS.dashboardStats(tenantId));
  }

  private strip(user: {
    passwordHash: string;
    [k: string]: unknown;
  }): Record<string, unknown> {
    const { passwordHash: _p, ...rest } = user;
    return rest;
  }
}
