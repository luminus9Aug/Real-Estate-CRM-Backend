import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { BrochureLinkDto } from './dto/brochure-link.dto';
import { CreatePropertyDto } from './dto/create-property.dto';
import { PropertyQueryDto } from './dto/property-query.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { PropertyService } from './property.service';

@Controller('properties')
export class PropertyController {
  constructor(private readonly properties: PropertyService) {}

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
  create(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CreatePropertyDto,
  ): Promise<unknown> {
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
