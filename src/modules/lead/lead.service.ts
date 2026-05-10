import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityType,
  CommissionStatus,
  CommissionType,
  LeadStatus,
  Prisma,
  PropertyStatus,
  UserRole,
} from '@prisma/client';
import * as crypto from 'crypto';
import type Redis from 'ioredis';
import { I18nService } from 'nestjs-i18n';
import { TenantPrismaService } from '../../common/utils/tenant-prisma.service';
import { CACHE_KEYS } from '../../common/constants/app.constants';
import { MessageGateway } from '../../gateways/message.gateway';
import { REDIS } from '../../redis/redis.module';
import { AssignLeadDto } from './dto/assign-lead.dto';
import { CloseLeadDto } from './dto/close-lead.dto';
import { CreateLeadDto } from './dto/create-lead.dto';
import { LeadFollowupDto } from './dto/lead-followup.dto';
import { LeadQueryDto } from './dto/lead-query.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';

import { calculateCommission, AgentForCommission } from '../../common/utils/commission-calculator.util';

@Injectable()
export class LeadService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly gateway: MessageGateway,
    private readonly i18n: I18nService,
  ) {}

  private getQueryHash(query: any): string {
    return crypto.createHash('md5').update(JSON.stringify(query)).digest('hex');
  }

  async list(tenantId: string, query: LeadQueryDto): Promise<{ items: unknown[]; nextCursor: string | null }> {
    const hash = this.getQueryHash(query);
    const cacheKey = CACHE_KEYS.leadsList(tenantId, hash);
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const limit = Math.min(query.limit ?? 20, 100);
    const take = limit + 1;
    const where: Prisma.LeadWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
    };

    const items = await this.tenantPrisma.client.lead.findMany({
      where,
      take,
      skip: query.cursor ? 1 : 0,
      cursor: query.cursor ? { id: query.cursor } : undefined,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore && page.length > 0 ? page[page.length - 1].id : null;

    const result = { items: page, nextCursor };
    await this.redis.set(cacheKey, JSON.stringify(result), 'EX', 30);
    return result;
  }

  async findOne(id: string, tenantId?: string): Promise<unknown> {
    const tId = tenantId || (await this.tenantPrisma.client.lead.findUnique({ where: { id }, select: { tenantId: true } }))?.tenantId;
    if (!tId) throw new NotFoundException(this.i18n.t('leads.lead_not_found'));

    const cacheKey = CACHE_KEYS.lead(tId, id);
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const lead = await this.tenantPrisma.client.lead.findFirst({
      where: { id, deletedAt: null },
      include: { assignedTo: true, createdBy: true },
    });
    if (!lead) throw new NotFoundException(this.i18n.t('leads.lead_not_found'));

    await this.redis.set(cacheKey, JSON.stringify(lead), 'EX', 60);
    return lead;
  }

  async create(tenantId: string, userId: string, dto: CreateLeadDto): Promise<unknown> {
    const lead = await this.tenantPrisma.client.lead.create({
      data: {
        tenantId,
        createdById: userId,
        name: dto.name,
        phone: dto.phone,
        email: dto.email,
        alternatePhone: dto.alternatePhone,
        budgetMin:
          dto.budgetMin !== undefined ? new Prisma.Decimal(dto.budgetMin) : undefined,
        budgetMax:
          dto.budgetMax !== undefined ? new Prisma.Decimal(dto.budgetMax) : undefined,
        message: dto.message,
        status: dto.status,
        source: dto.source,
        preferredLanguage: dto.preferredLanguage,
        preferredPropertyId: dto.preferredPropertyId,
      },
    });
    await this.invalidateLeadCaches(tenantId);
    return lead;
  }

  async update(id: string, tenantId: string, dto: UpdateLeadDto): Promise<unknown> {
    const existing = await this.tenantPrisma.client.lead.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException(this.i18n.t('leads.lead_not_found'));

    const data: Prisma.LeadUpdateInput = {
      ...dto,
      budgetMin:
        dto.budgetMin !== undefined ? new Prisma.Decimal(dto.budgetMin) : undefined,
      budgetMax:
        dto.budgetMax !== undefined ? new Prisma.Decimal(dto.budgetMax) : undefined,
    };

    const lead = await this.tenantPrisma.client.lead.update({
      where: { id },
      data,
    });
    await this.invalidateLeadCaches(tenantId);
    return lead;
  }

  async softDelete(id: string, tenantId: string): Promise<unknown> {
    const existing = await this.tenantPrisma.client.lead.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException(this.i18n.t('leads.lead_not_found'));

    const lead = await this.tenantPrisma.client.lead.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.invalidateLeadCaches(tenantId);
    return lead;
  }

  async assign(leadId: string, tenantId: string, dto: AssignLeadDto): Promise<unknown> {
    const lead = await this.tenantPrisma.client.lead.findFirst({
      where: { id: leadId, deletedAt: null },
    });
    if (!lead) throw new NotFoundException(this.i18n.t('leads.lead_not_found'));

    const agent = await this.tenantPrisma.client.user.findFirst({
      where: { id: dto.agentId, deletedAt: null, role: { in: [UserRole.AGENT, UserRole.MANAGER] } },
    });
    if (!agent) throw new BadRequestException(this.i18n.t('common.invalid_agent'));

    const updated = await this.tenantPrisma.client.lead.update({
      where: { id: leadId },
      data: { assignedToId: dto.agentId },
      include: { assignedTo: true },
    });

    this.gateway.emitLeadAssigned(tenantId, {
      leadId,
      agentId: dto.agentId,
      agentName: agent.name,
    });

    await this.invalidateLeadCaches(tenantId);
    return updated;
  }

  async closeLead(
    leadId: string,
    tenantId: string,
    dto: CloseLeadDto,
    closingUserId: string,
    closerRole: UserRole,
  ): Promise<unknown> {
    if (closerRole === UserRole.AGENT) {
      throw new ForbiddenException();
    }

    const lead = await this.tenantPrisma.client.lead.findFirst({
      where: { id: leadId, deletedAt: null, status: { not: LeadStatus.CONVERTED } },
      include: {
        assignedTo: true,
        tenant: { select: { currency: true } },
      },
    });

    if (!lead) throw new NotFoundException(this.i18n.t('leads.lead_not_found_or_converted'));
    if (!lead.assignedTo) throw new BadRequestException(this.i18n.t('leads.assign_agent_before_closing'));

    const property = await this.tenantPrisma.client.property.findFirst({
      where: { id: dto.closedPropertyId, deletedAt: null },
    });
    if (!property) throw new NotFoundException(this.i18n.t('properties.property_not_found'));

    const commission = calculateCommission(lead.assignedTo as AgentForCommission, dto.finalSaleValue);

    const updated = await this.tenantPrisma.client.$transaction(async (tx) => {
      const u = await tx.lead.update({
        where: { id: leadId },
        data: {
          status: LeadStatus.CONVERTED,
          convertedAt: new Date(),
          closedAt: new Date(),
          finalSaleValue: new Prisma.Decimal(dto.finalSaleValue),
          closedPropertyId: dto.closedPropertyId,
        },
      });

      await tx.commissionTransaction.create({
        data: {
          tenantId,
          leadId,
          agentId: lead.assignedToId as string,
          createdById: closingUserId,
          amount: commission,
          currency: lead.tenant.currency,
          status: CommissionStatus.PENDING,
          calculatedAt: new Date(),
        },
      });

      await tx.property.update({
        where: { id: dto.closedPropertyId },
        data: { status: PropertyStatus.SOLD },
      });

      await tx.activity.create({
        data: {
          tenantId,
          leadId,
          userId: closingUserId,
          type: ActivityType.NOTE,
          notes: `Lead closed. Sale: ${lead.tenant.currency} ${dto.finalSaleValue}. Commission: ${commission.toString()}`,
        },
      });

      return u;
    });

    await this.invalidateLeadCaches(tenantId);
    await this.redis.del(CACHE_KEYS.commissionPending(tenantId));
    return updated;
  }

  async addFollowup(leadId: string, tenantId: string, dto: LeadFollowupDto): Promise<unknown> {
    const lead = await this.tenantPrisma.client.lead.findFirst({
      where: { id: leadId, deletedAt: null },
    });
    if (!lead) throw new NotFoundException(this.i18n.t('leads.lead_not_found'));

    const followUp = await this.tenantPrisma.client.followUp.create({
      data: {
        tenantId,
        leadId,
        assignedToId: dto.assignedToId,
        message: dto.message,
        dueAt: new Date(dto.dueAt),
      },
    });

    await this.invalidateLeadCaches(tenantId, leadId);
    return followUp;
  }

  private async invalidateLeadCaches(tenantId: string, leadId?: string): Promise<void> {
    const keys = [CACHE_KEYS.dashboardStats(tenantId)];
    if (leadId) keys.push(CACHE_KEYS.lead(tenantId, leadId));

    await this.redis.del(...keys);
  }
}
