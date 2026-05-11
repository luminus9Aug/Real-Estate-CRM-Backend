import { Body, Controller, Delete, Get, Param, Post, Put, Query, UsePipes } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
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

@Controller('leads')
export class LeadController {
  constructor(private readonly leads: LeadService) { }

  @Get()
  list(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: LeadQueryDto,
  ): Promise<{ items: unknown[]; nextCursor: string | null }> {
    return this.leads.list(tenantId, query);
  }

  @Post()
  @UsePipes(new ZodValidationPipe(CreateLeadSchema))
  create(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateLeadDto,
  ): Promise<unknown> {
    console.log("CurrentUser", CurrentUser)
    return this.leads.create(tenantId, userId, dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<unknown> {
    return this.leads.findOne(id);
  }

  @Put(':id')
  @UsePipes(new ZodValidationPipe(UpdateLeadSchema))
  update(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: UpdateLeadDto,
  ): Promise<unknown> {
    return this.leads.update(id, tenantId, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser('tenantId') tenantId: string): Promise<unknown> {
    return this.leads.softDelete(id, tenantId);
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Post(':id/assign')
  assign(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: AssignLeadDto,
  ): Promise<unknown> {
    return this.leads.assign(id, tenantId, dto);
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Post(':id/close')
  close(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Body() dto: CloseLeadDto,
  ): Promise<unknown> {
    return this.leads.closeLead(id, tenantId, dto, userId, role);
  }

  @Post(':id/followup')
  followup(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: LeadFollowupDto,
  ): Promise<unknown> {
    return this.leads.addFollowup(id, tenantId, dto);
  }
}
