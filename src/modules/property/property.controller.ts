import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../auth/types/auth-user.type';
import { BrochureLinkDto } from './dto/brochure-link.dto';
import { CreatePropertyDto } from './dto/create-property.dto';
import { PropertyQueryDto } from './dto/property-query.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { AssignPropertyDto } from './dto/assign-property.dto';
import { PropertyService } from './property.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/constants/roles.constants';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UseGuards, ForbiddenException } from '@nestjs/common';
import { SubscriptionActiveGuard } from '../../common/guards/subscription-active.guard';
import { FeatureGateGuard } from '../../common/guards/feature-gate.guard';
import { SubscriptionService } from '../subscription/subscription.service';
import { FeatureKey } from '../../common/constants/features.constants';
import { Public } from '../../common/decorators/public.decorator';

@UseGuards(SubscriptionActiveGuard, FeatureGateGuard)
@Controller('properties')
export class PropertyController {
  constructor(
    private readonly properties: PropertyService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: PropertyQueryDto,
  ): Promise<{ items: unknown[]; nextCursor: string | null }> {
    return this.properties.list(user, query);
  }

  @Get('map')
  map(@CurrentUser() user: AuthUser): Promise<unknown[]> {
    return this.properties.map(user);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<unknown> {
    return this.properties.findOne(user, id);
  }

  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePropertyDto,
  ): Promise<unknown> {
    const count = await this.properties.countActiveProperties(user);
    const ok = await this.subscriptionService.validateFeatureLimit(
      user.tenantId!,
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

    return this.properties.create(user, dto);
  }

  @Put(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdatePropertyDto,
  ): Promise<unknown> {
    return this.properties.update(user, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<unknown> {
    return this.properties.softDelete(user, id);
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @UseGuards(RolesGuard)
  @Post(':id/assign')
  assign(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AssignPropertyDto,
  ): Promise<unknown> {
    return this.properties.assign(user, id, dto);
  }

  @Post(':id/brochure-link')
  brochureLink(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: BrochureLinkDto,
  ): Promise<{ token: string; expiresAt: Date }> {
    return this.properties.createBrochureLink(user, id, dto);
  }

  @Public()
  @Get('brochure/:token')
  findByBrochureToken(@Param('token') token: string): Promise<unknown> {
    return this.properties.findByBrochureToken(token);
  }
}
