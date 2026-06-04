import { Injectable, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import type Redis from 'ioredis';
import { Inject } from '@nestjs/common';
import { TenantPrismaService } from '../../common/utils/tenant-prisma.service';
import { CACHE_KEYS } from '../../common/constants/app.constants';
import { REDIS } from '../../redis/redis.module';
import { BrochureLinkDto } from './dto/brochure-link.dto';
import { CreatePropertyDto } from './dto/create-property.dto';
import { PropertyQueryDto } from './dto/property-query.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { QuotaCounterService } from '../../common/utils/quota-counter.service';

@Injectable()
export class PropertyService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly i18n: I18nService,
    private readonly quotaCounter: QuotaCounterService,
  ) {}

  async list(tenantId: string, query: PropertyQueryDto): Promise<{ items: unknown[]; nextCursor: string | null }> {
    const limit = Math.min(query.limit ?? 20, 100);
    const take = limit + 1;
    const where: Prisma.PropertyWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
    };

    const items = await this.tenantPrisma.client.property.findMany({
      where,
      take,
      skip: query.cursor ? 1 : 0,
      cursor: query.cursor ? { id: query.cursor } : undefined,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore && page.length > 0 ? page[page.length - 1].id : null;

    return { items: page, nextCursor };
  }

  async map(tenantId: string): Promise<unknown[]> {
    return this.tenantPrisma.client.property.findMany({
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
      },
      take: 500,
    });
  }

  async findOne(id: string): Promise<unknown> {
    const p = await this.tenantPrisma.client.property.findFirst({
      where: { id, deletedAt: null },
    });
    if (!p) throw new NotFoundException(this.i18n.t('properties.property_not_found'));
    return p;
  }

  async create(tenantId: string, dto: CreatePropertyDto): Promise<unknown> {
    const property = await this.tenantPrisma.client.property.create({
      data: {
        tenantId,
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
    await this.quotaCounter.increment(tenantId, 'MAX_PROPERTIES');
    await this.redis.del(CACHE_KEYS.dashboardStats(tenantId));
    return property;
  }

  async update(id: string, tenantId: string, dto: UpdatePropertyDto): Promise<unknown> {
    const existing = await this.tenantPrisma.client.property.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException(this.i18n.t('properties.property_not_found'));

    const data: Prisma.PropertyUpdateInput = {
      ...dto,
      price: dto.price !== undefined ? new Prisma.Decimal(dto.price) : undefined,
    };

    const property = await this.tenantPrisma.client.property.update({
      where: { id },
      data,
    });
    await this.redis.del(CACHE_KEYS.dashboardStats(tenantId));
    return property;
  }

  async softDelete(id: string, tenantId: string): Promise<unknown> {
    const existing = await this.tenantPrisma.client.property.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException(this.i18n.t('properties.property_not_found'));

    const property = await this.tenantPrisma.client.property.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.quotaCounter.decrement(tenantId, 'MAX_PROPERTIES');
    await this.redis.del(CACHE_KEYS.dashboardStats(tenantId));
    return property;
  }

  async createBrochureLink(
    propertyId: string,
    tenantId: string,
    dto: BrochureLinkDto,
  ): Promise<{ token: string; expiresAt: Date }> {
    const property = await this.tenantPrisma.client.property.findFirst({
      where: { id: propertyId, deletedAt: null },
    });
    if (!property) throw new NotFoundException(this.i18n.t('properties.property_not_found'));

    const hours = dto.expiresInHours ?? 72;
    const randomHex = randomBytes(12).toString('hex');
    const token = `${tenantId}_${randomHex}`; // Composite token format
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);

    await this.tenantPrisma.client.brochureLink.create({
      data: {
        tenantId,
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

    const link = await this.tenantPrisma.client.brochureLink.findFirst({
      where: {
        token,
        tenantId,
      },
      include: {
        property: true,
      },
    });

    if (!link || link.expiresAt < new Date() || link.property.deletedAt !== null) {
      throw new NotFoundException(this.i18n.t('properties.property_not_found'));
    }

    // Increment openedCount asynchronously (non-blocking)
    this.tenantPrisma.client.brochureLink.update({
      where: { id: link.id },
      data: { openedCount: { increment: 1 } },
    }).catch(err => {
      console.error('Failed to increment brochure link opened count:', err);
    });

    return link.property;
  }

  async countActiveProperties(): Promise<number> {
    return this.tenantPrisma.client.property.count({
      where: {
        deletedAt: null,
      },
    });
  }
}
