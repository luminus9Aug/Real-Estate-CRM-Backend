import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';

@Controller('admin/tenants')
@UseGuards(SuperAdminGuard)
export class AdminTenantController {
  constructor(private readonly adminService: AdminService) { }

  @Get()
  async list(@Query('page') page: number = 1, @Query('limit') limit: number = 20) {
    return this.adminService.listAllTenants(page, limit);
  }

  @Get(':id')
  async getDetails(@Param('id') id: string) {
    return this.adminService.getTenantDetails(id);
  }

  @Post(':id/suspend')
  async suspend(@Param('id') id: string, @CurrentUser('id') adminId: string) {
    return this.adminService.suspendTenant(id, adminId);
  }

  @Post(':id/activate')
  async activate(@Param('id') id: string, @CurrentUser('id') adminId: string) {
    return this.adminService.activateTenant(id, adminId);
  }
}
