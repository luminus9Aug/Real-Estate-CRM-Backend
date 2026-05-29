import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('admin')
@UseGuards(SuperAdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  async getStats() {
    return this.adminService.getGlobalStats();
  }

  @Get('tenants')
  async listTenants(
    @Query('page') page: string,
    @Query('limit') limit: string,
  ) {
    return this.adminService.listAllTenants(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }

  @Get('tenants/:id')
  async getTenant(@Param('id') id: string) {
    return this.adminService.getTenantDetails(id);
  }

  @Post('tenants/:id/suspend')
  async suspendTenant(
    @Param('id') id: string,
    @CurrentUser('id') adminId: string,
  ) {
    return this.adminService.suspendTenant(id, adminId);
  }

  @Post('tenants/:id/activate')
  async activateTenant(
    @Param('id') id: string,
    @CurrentUser('id') adminId: string,
  ) {
    return this.adminService.activateTenant(id, adminId);
  }

  @Get('audit-logs')
  async getAuditLogs(
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getAuditLogs(
      cursor,
      limit ? parseInt(limit) : 20,
    );
  }
}
