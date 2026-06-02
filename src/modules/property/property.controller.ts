import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { BrochureLinkDto } from './dto/brochure-link.dto';
import { CreatePropertyDto } from './dto/create-property.dto';
import { PropertyQueryDto } from './dto/property-query.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { PropertyService } from './property.service';

import { UseGuards, ForbiddenException } from '@nestjs/common';
import { SubscriptionActiveGuard } from '../../common/guards/subscription-active.guard';
import { FeatureGateGuard } from '../../common/guards/feature-gate.guard';
import { SubscriptionService } from '../subscription/subscription.service';
import { FeatureKey } from '../../common/constants/features.constants';

@UseGuards(SubscriptionActiveGuard, FeatureGateGuard)
@Controller('properties')
export class PropertyController {
  constructor(
    private readonly properties: PropertyService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  @Get()
  list(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: PropertyQueryDto,
  ): Promise<{ items: unknown[]; nextCursor: string | null }> {
    return this.properties.list(tenantId, query);
  }

  @Get('map')
  map(@CurrentUser('tenantId') tenantId: string): Promise<unknown[]> {
    return this.properties.map(tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<unknown> {
    return this.properties.findOne(id);
  }

  @Post()
  async create(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CreatePropertyDto,
  ): Promise<unknown> {
    const count = await this.properties.countActiveProperties();
    const ok = await this.subscriptionService.validateFeatureLimit(
      tenantId,
      FeatureKey.MAX_PROPERTIES,
      count,
    );

    if (!ok) {
      throw new ForbiddenException({
        code: 'PLAN_LIMIT_REACHED',
        featureKey: FeatureKey.MAX_PROPERTIES,
        message: 'Property limit reached for your plan. Please upgrade.',
      });
    }

    return this.properties.create(tenantId, dto);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: UpdatePropertyDto,
  ): Promise<unknown> {
    return this.properties.update(id, tenantId, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser('tenantId') tenantId: string): Promise<unknown> {
    return this.properties.softDelete(id, tenantId);
  }

  @Post(':id/brochure-link')
  brochureLink(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: BrochureLinkDto,
  ): Promise<{ token: string; expiresAt: Date }> {
    return this.properties.createBrochureLink(id, tenantId, dto);
  }
}
