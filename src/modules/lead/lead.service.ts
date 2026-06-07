import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ActivityType,
  CommissionStatus,
  CommissionType,
  LeadStatus,
  Prisma,
  PropertyStatus,
  UserRole,
} from "@prisma/client";
import * as crypto from "crypto";
import type Redis from "ioredis";
import { I18nService } from "nestjs-i18n";
import { LeadRepository } from "./lead.repository";
import { CACHE_KEYS } from "../../common/constants/app.constants";
import { AuthUser } from "../auth/types/auth-user.type";
import { UserRepository } from "../user/user.repository";
import { PropertyRepository } from "../property/property.repository";
import { CommissionTransactionRepository } from "../commission/commission-transaction.repository";
import { ActivityRepository } from "../dashboard/activity.repository";
import { FollowUpRepository } from "../followup/followup.repository";
import { MessageGateway } from "../../gateways/message.gateway";
import { REDIS } from "../../redis/redis.module";
import { AssignLeadDto } from "./dto/assign-lead.dto";
import { CloseLeadDto } from "./dto/close-lead.dto";
import { CreateLeadDto } from "./dto/create-lead.dto";
import { LeadFollowupDto } from "./dto/lead-followup.dto";
import { LeadQueryDto } from "./dto/lead-query.dto";
import { UpdateLeadDto } from "./dto/update-lead.dto";
import { QuotaCounterService } from "../../common/utils/quota-counter.service";

import {
  CommissionCalculator,
  AgentForCommission,
} from "../../common/utils/commission-calculator.util";

@Injectable()
export class LeadService {
  constructor(
    private readonly leadRepository: LeadRepository,
    private readonly userRepository: UserRepository,
    private readonly propertyRepository: PropertyRepository,
    private readonly commissionRepo: CommissionTransactionRepository,
    private readonly activityRepo: ActivityRepository,
    private readonly followupRepo: FollowUpRepository,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly gateway: MessageGateway,
    private readonly i18n: I18nService,
    private readonly quotaCounter: QuotaCounterService,
  ) {}

  private getQueryHash(query: object): string {
    return crypto.createHash("md5").update(JSON.stringify(query)).digest("hex");
  }

  async list(
    user: AuthUser,
    query: LeadQueryDto,
  ): Promise<{ items: unknown[]; nextCursor: string | null }> {
    const hash = this.getQueryHash(query);
    const cacheKey = CACHE_KEYS.leadsList(user.tenantId ?? "global", hash);
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const limit = Math.min(query.limit ?? 20, 100);
    const take = limit + 1;
    const where: Prisma.LeadWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
    };

    const items = await this.leadRepository.findMany(user, {
      where,
      take,
      skip: query.cursor ? 1 : 0,
      cursor: query.cursor ? { id: query.cursor } : undefined,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    const nextCursor =
      hasMore && page.length > 0 ? page[page.length - 1].id : null;

    const result = { items: page, nextCursor };
    await this.redis.set(cacheKey, JSON.stringify(result), "EX", 30);
    return result;
  }

  async findOne(user: AuthUser, id: string): Promise<unknown> {
    const cacheKey = CACHE_KEYS.lead(user.tenantId ?? "global", id);
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const lead = await this.leadRepository.findFirst(user, {
      where: { id, deletedAt: null },
      include: { assignedTo: true, createdBy: true },
    });
    if (!lead) throw new NotFoundException(this.i18n.t("leads.lead_not_found"));

    await this.redis.set(cacheKey, JSON.stringify(lead), "EX", 60);
    return lead;
  }

  async create(user: AuthUser, dto: CreateLeadDto): Promise<unknown> {
    const lead = await this.leadRepository.create(user, {
      data: {
        tenantId: user.tenantId!,
        createdById: user.id,
        name: dto.name,
        phone: dto.phone,
        email: dto.email,
        alternatePhone: dto.alternatePhone,
        budgetMin:
          dto.budgetMin !== undefined
            ? new Prisma.Decimal(dto.budgetMin)
            : undefined,
        budgetMax:
          dto.budgetMax !== undefined
            ? new Prisma.Decimal(dto.budgetMax)
            : undefined,
        message: dto.message,
        status: dto.status,
        source: dto.source,
        preferredLanguage: dto.preferredLanguage,
        preferredPropertyId: dto.preferredPropertyId,
      },
    });
    if (user.tenantId) {
      await this.quotaCounter.increment(user.tenantId, "MAX_LEADS_PER_MONTH");
      await this.invalidateLeadCaches(user.tenantId);
    }
    return lead;
  }

  async update(
    user: AuthUser,
    id: string,
    dto: UpdateLeadDto,
  ): Promise<unknown> {
    const existing = await this.leadRepository.findFirst(user, {
      where: { id, deletedAt: null },
    });
    if (!existing)
      throw new NotFoundException(this.i18n.t("leads.lead_not_found"));

    const data: Prisma.LeadUpdateInput = {
      ...dto,
      budgetMin:
        dto.budgetMin !== undefined
          ? new Prisma.Decimal(dto.budgetMin)
          : undefined,
      budgetMax:
        dto.budgetMax !== undefined
          ? new Prisma.Decimal(dto.budgetMax)
          : undefined,
    };

    const lead = await this.leadRepository.update(user, {
      where: { id },
      data,
    });
    if (user.tenantId) {
      await this.invalidateLeadCaches(user.tenantId, id);
    }
    return lead;
  }

  async softDelete(user: AuthUser, id: string): Promise<unknown> {
    const existing = await this.leadRepository.findFirst(user, {
      where: { id, deletedAt: null },
    });
    if (!existing)
      throw new NotFoundException(this.i18n.t("leads.lead_not_found"));

    const lead = await this.leadRepository.softDelete(user, {
      where: { id },
      data: {},
    });
    if (user.tenantId) {
      await this.invalidateLeadCaches(user.tenantId, id);
    }
    return lead;
  }

  async assign(
    user: AuthUser,
    leadId: string,
    dto: AssignLeadDto,
  ): Promise<unknown> {
    const lead = await this.leadRepository.findFirst(user, {
      where: { id: leadId, deletedAt: null },
    });
    if (!lead) throw new NotFoundException(this.i18n.t("leads.lead_not_found"));

    let agentName = 'Unassigned';

    if (dto.agentId) {
      const agent = await this.userRepository.findFirst(user, {
        where: {
          id: dto.agentId,
          deletedAt: null,
          role: { in: [UserRole.AGENT, UserRole.MANAGER] },
        },
      });
      if (!agent)
        throw new BadRequestException(this.i18n.t("common.invalid_agent"));
      agentName = agent.name;
    }

    const updated = await this.leadRepository.update(user, {
      where: { id: leadId },
      data: { assignedToId: dto.agentId || null },
      include: { assignedTo: true },
    });

    if (user.tenantId && dto.agentId) {
      this.gateway.emitLeadAssigned(user.tenantId, {
        leadId,
        agentId: dto.agentId,
        agentName: agentName,
      });
    }

    if (user.tenantId) {
      await this.invalidateLeadCaches(user.tenantId, leadId);
    }
    return updated;
  }

  async closeLead(
    user: AuthUser,
    leadId: string,
    dto: CloseLeadDto,
  ): Promise<unknown> {
    if (user.role === UserRole.AGENT) {
      throw new ForbiddenException();
    }

    const lead = (await this.leadRepository.findFirst(user, {
      where: {
        id: leadId,
        deletedAt: null,
        status: { not: LeadStatus.CONVERTED },
      },
      include: {
        assignedTo: true,
        tenant: { select: { currency: true } },
      },
    })) as any;

    if (!lead)
      throw new NotFoundException(
        this.i18n.t("leads.lead_not_found_or_converted"),
      );
    if (!lead.assignedTo)
      throw new BadRequestException(
        this.i18n.t("leads.assign_agent_before_closing"),
      );

    const property = await this.propertyRepository.findFirst(user, {
      where: { id: dto.closedPropertyId, deletedAt: null },
    });
    if (!property)
      throw new NotFoundException(this.i18n.t("properties.property_not_found"));

    const commission = CommissionCalculator.calculate(
      lead.assignedTo as AgentForCommission,
      dto.finalSaleValue,
    );

    // Keep Prisma transaction since it's cross-repo
    const updated = await this.leadRepository["prisma"].$transaction(
      async (tx) => {
        const u = await this.leadRepository.update(
          user,
          {
            where: { id: leadId },
            data: {
              status: LeadStatus.CONVERTED,
              convertedAt: new Date(),
              closedAt: new Date(),
              finalSaleValue: new Prisma.Decimal(dto.finalSaleValue),
              closedPropertyId: dto.closedPropertyId,
            },
          },
          tx,
        );

        await this.commissionRepo.create(
          user,
          {
            data: {
              tenantId: user.tenantId!,
              leadId,
              agentId: lead.assignedToId as string,
              createdById: user.id,
              amount: commission,
              currency: lead.tenant.currency,
              status: CommissionStatus.PENDING,
              calculatedAt: new Date(),
            },
          },
          tx,
        );

        await this.propertyRepository.update(
          user,
          {
            where: { id: dto.closedPropertyId },
            data: { status: PropertyStatus.SOLD },
          },
          tx,
        );

        await this.activityRepo.create(
          user,
          {
            data: {
              tenantId: user.tenantId!,
              leadId,
              userId: user.id,
              type: ActivityType.NOTE,
              notes: `Lead closed. Sale: ${lead.tenant.currency} ${dto.finalSaleValue}. Commission: ${commission.toString()}`,
            },
          },
          tx,
        );

        return u;
      },
    );

    if (user.tenantId) {
      await this.invalidateLeadCaches(user.tenantId, leadId);
      await this.redis.del(CACHE_KEYS.commissionPending(user.tenantId));
    }
    return updated;
  }

  async addFollowup(
    user: AuthUser,
    leadId: string,
    dto: LeadFollowupDto,
  ): Promise<unknown> {
    const lead = await this.leadRepository.findFirst(user, {
      where: { id: leadId, deletedAt: null },
    });
    if (!lead) throw new NotFoundException(this.i18n.t("leads.lead_not_found"));

    const followUp = await this.followupRepo.create(user, {
      data: {
        tenantId: user.tenantId!,
        leadId,
        assignedToId: dto.assignedToId,
        message: dto.message,
        dueAt: new Date(dto.dueAt),
      },
    });

    if (user.tenantId) {
      await this.invalidateLeadCaches(user.tenantId, leadId);
    }
    return followUp;
  }

  async countMonthlyLeads(user: AuthUser): Promise<number> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    return this.leadRepository.count(user, {
      where: {
        createdAt: { gte: startOfMonth },
        deletedAt: null,
      },
    });
  }

  private async invalidateLeadCaches(
    tenantId: string,
    leadId?: string,
  ): Promise<void> {
    const keys = [CACHE_KEYS.dashboardStats(tenantId)];
    if (leadId) keys.push(CACHE_KEYS.lead(tenantId, leadId));

    await this.redis.del(...keys);
  }
}
