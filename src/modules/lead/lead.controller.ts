import { Body, Controller, Delete, Get, Param, Post, Put, Query, UsePipes } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../auth/types/auth-user.type';
import { Roles } from '../../common/decorators/roles.decorator';
import { AssignLeadDto } from './dto/assign-lead.dto';
import { CloseLeadDto } from './dto/close-lead.dto';
import { CreateLeadDto } from './dto/create-lead.dto';
import { LeadFollowupDto } from './dto/lead-followup.dto';
import { LeadQueryDto } from './dto/lead-query.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { LeadService } from './lead.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CreateLeadSchema, UpdateLeadSchema } from './schemas/create-lead.schema';

import { UseGuards, ForbiddenException } from '@nestjs/common';
import { SubscriptionActiveGuard } from '../../common/guards/subscription-active.guard';
import { FeatureGateGuard } from '../../common/guards/feature-gate.guard';
import { SubscriptionService } from '../subscription/subscription.service';
import { FeatureKey } from '../../common/constants/features.constants';

@UseGuards(SubscriptionActiveGuard, FeatureGateGuard)
@Controller('leads')
export class LeadController {
  constructor(
    private readonly leads: LeadService,
    private readonly subscriptionService: SubscriptionService,
  ) { }

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: LeadQueryDto,
  ): Promise<{ items: unknown[]; nextCursor: string | null }> {
    return this.leads.list(user, query);
  }

  @Post()
  @UsePipes(new ZodValidationPipe(CreateLeadSchema))
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateLeadDto,
  ): Promise<unknown> {
    const count = await this.leads.countMonthlyLeads(user);
    const ok = await this.subscriptionService.validateFeatureLimit(
      user.tenantId!,
      FeatureKey.MAX_LEADS_PER_MONTH,
      count,
    );

    if (!ok) {
      throw new ForbiddenException({
        code: 'PLAN_LIMIT_REACHED',
        featureKey: FeatureKey.MAX_LEADS_PER_MONTH,
        message: 'Monthly lead limit reached for your plan. Please upgrade.',
      });
    }

    return this.leads.create(user, dto);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<unknown> {
    return this.leads.findOne(user, id);
  }

  @Put(':id')
  @UsePipes(new ZodValidationPipe(UpdateLeadSchema))
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateLeadDto,
  ): Promise<unknown> {
    return this.leads.update(user, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<unknown> {
    return this.leads.softDelete(user, id);
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Post(':id/assign')
  assign(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AssignLeadDto,
  ): Promise<unknown> {
    return this.leads.assign(user, id, dto);
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Post(':id/close')
  close(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CloseLeadDto,
  ): Promise<unknown> {
    return this.leads.closeLead(user, id, dto);
  }

  @Post(':id/followup')
  followup(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: LeadFollowupDto,
  ): Promise<unknown> {
    return this.leads.addFollowup(user, id, dto);
  }
}
