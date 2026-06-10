import { Injectable, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import type Redis from 'ioredis';
import { Inject } from '@nestjs/common';
import { PropertyRepository } from './property.repository';
import { UserRepository } from '../user/user.repository';
import { BrochureLinkRepository } from './brochure-link.repository';
import { AuthUser } from '../auth/types/auth-user.type';
import { CACHE_KEYS } from '../../common/constants/app.constants';
import { REDIS } from '../../redis/redis.module';
import { BrochureLinkDto } from './dto/brochure-link.dto';
import { CreatePropertyDto } from './dto/create-property.dto';
import { PropertyQueryDto } from './dto/property-query.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { AssignPropertyDto } from './dto/assign-property.dto';
import { QuotaCounterService } from '../../common/utils/quota-counter.service';
import { UserRole } from '../../common/constants/roles.constants';
import { BadRequestException } from '@nestjs/common';

@Injectable()
export class PropertyService {
  constructor(
    private readonly propertyRepository: PropertyRepository,
    private readonly userRepository: UserRepository,
    private readonly brochureLinkRepository: BrochureLinkRepository,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly i18n: I18nService,
    private readonly quotaCounter: QuotaCounterService,
  ) {}

  async list(user: AuthUser, query: PropertyQueryDto): Promise<{ items: unknown[]; nextCursor: string | null }> {
    const limit = Math.min(query.limit ?? 20, 100);
    const take = limit + 1;
    const where: Prisma.PropertyWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
    };

    const items = await this.propertyRepository.findMany(user, {
      where,
      take,
      skip: query.cursor ? 1 : 0,
      cursor: query.cursor ? { id: query.cursor } : undefined,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore && page.length > 0 ? page[page.length - 1].id : null;

    return { items: page, nextCursor };
  }

  async map(user: AuthUser): Promise<unknown[]> {
    return this.propertyRepository.findMany(user, {
      where: {
        deletedAt: null,
        latitude: { not: null },
        longitude: { not: null },
      },
      select: {
        id: true,
        title: true,
        latitude: true,
        longitude: true,
        status: true,
        price: true,
        location: true,
        images: true,   // needed for photo markers on the map
      },
      take: 500,
    });
  }

  async findOne(user: AuthUser, id: string): Promise<unknown> {
    const p = await this.propertyRepository.findFirst(user, {
      where: { id, deletedAt: null },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });
    if (!p) throw new NotFoundException(this.i18n.t('properties.property_not_found'));
    return p;
  }

  async create(user: AuthUser, dto: CreatePropertyDto): Promise<unknown> {
    const property = await this.propertyRepository.create(user, {
      data: {
        tenantId: user.tenantId!,
        title: dto.title,
        description: dto.description,
        type: dto.type,
        status: dto.status,
        price: dto.price !== undefined ? new Prisma.Decimal(dto.price) : undefined,
        areaSqFt: dto.areaSqFt,
        bhk: dto.bhk,
        floor: dto.floor,
        location: dto.location,
        latitude: dto.latitude,
        longitude: dto.longitude,
        images: dto.images ?? [],
        brochures: dto.brochures ?? [],
        features: dto.features ?? [],
      },
    });
    if (user.tenantId) {
      await this.quotaCounter.increment(user.tenantId, 'MAX_PROPERTIES');
      await this.redis.del(CACHE_KEYS.dashboardStats(user.tenantId));
    }
    return property;
  }

  async update(user: AuthUser, id: string, dto: UpdatePropertyDto): Promise<unknown> {
    const existing = await this.propertyRepository.findFirst(user, {
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException(this.i18n.t('properties.property_not_found'));

    const data: Prisma.PropertyUpdateInput = {
      ...dto,
      price: dto.price !== undefined ? new Prisma.Decimal(dto.price) : undefined,
    };

    const property = await this.propertyRepository.update(user, {
      where: { id },
      data,
    });
    if (user.tenantId) {
      await this.redis.del(CACHE_KEYS.dashboardStats(user.tenantId));
    }
    return property;
  }

  async softDelete(user: AuthUser, id: string): Promise<unknown> {
    const existing = await this.propertyRepository.findFirst(user, {
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException(this.i18n.t('properties.property_not_found'));

    const property = await this.propertyRepository.softDelete(user, {
      where: { id },
      data: {}
    });
    if (user.tenantId) {
      await this.quotaCounter.decrement(user.tenantId, 'MAX_PROPERTIES');
      await this.redis.del(CACHE_KEYS.dashboardStats(user.tenantId));
    }
    return property;
  }

  async assign(user: AuthUser, propertyId: string, dto: AssignPropertyDto): Promise<unknown> {
    const property = await this.propertyRepository.findFirst(user, {
      where: { id: propertyId, deletedAt: null },
    });
    if (!property) throw new NotFoundException(this.i18n.t('properties.property_not_found'));

    if (dto.agentId) {
      const agent = await this.userRepository.findFirst(user, {
        where: {
          id: dto.agentId,
          role: { in: [UserRole.AGENT, UserRole.MANAGER] },
          deletedAt: null,
        },
      });
      if (!agent) throw new BadRequestException(this.i18n.t('common.invalid_agent'));
    }

    return this.propertyRepository.update(user, {
      where: { id: propertyId },
      data: { assignedToId: dto.agentId || null },
    });
  }

  async createBrochureLink(
    user: AuthUser,
    propertyId: string,
    dto: BrochureLinkDto,
  ): Promise<{ token: string; expiresAt: Date }> {
    const property = await this.propertyRepository.findFirst(user, {
      where: { id: propertyId, deletedAt: null },
    });
    if (!property) throw new NotFoundException(this.i18n.t('properties.property_not_found'));

    const hours = dto.expiresInHours ?? 72;
    const randomHex = randomBytes(12).toString('hex');
    const token = `${user.tenantId}_${randomHex}`; // Composite token format
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);

    await this.brochureLinkRepository.create(user, {
      data: {
        tenantId: user.tenantId!,
        propertyId,
        token,
        expiresAt,
      },
    });

    return { token, expiresAt };
  }

  async findByBrochureToken(token: string): Promise<unknown> {
    const parts = token.split('_');
    if (parts.length < 2) {
      throw new NotFoundException(this.i18n.t('properties.property_not_found'));
    }
    const tenantId = parts[0];

    const userMock: AuthUser = { id: 'system', tenantId, role: 'AGENT', email: 'system', hasFullDataAccess: false };

    const link = await this.brochureLinkRepository.findFirst(userMock, {
      where: {
        token,
        tenantId,
      },
      include: {
        property: true,
      },
    }) as any;

    if (!link || link.expiresAt < new Date() || link.property.deletedAt !== null) {
      throw new NotFoundException(this.i18n.t('properties.property_not_found'));
    }

    // Increment openedCount asynchronously (non-blocking)
    this.brochureLinkRepository.update(userMock, {
      where: { id: link.id },
      data: { openedCount: { increment: 1 } },
    }).catch(err => {
      console.error('Failed to increment brochure link opened count:', err);
    });

    return link.property;
  }

  async countActiveProperties(user: AuthUser): Promise<number> {
    return this.propertyRepository.count(user, {
      where: {
        deletedAt: null,
      },
    });
  }
}
