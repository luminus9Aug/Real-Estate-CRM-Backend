import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { BlogService } from './blog.service';
import { CreateBlogPostDto, UpdateBlogPostDto } from './dto/create-blog.dto';
import { BlogPostResponseDto } from './dto/blog-response.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('admin/blogs')
@UseGuards(RolesGuard)
export class BlogController {
  constructor(private readonly blogService: BlogService) {}

  @Post()
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  create(
    @CurrentUser('tenantId') tenantId: string | null | undefined,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateBlogPostDto,
  ): Promise<BlogPostResponseDto> {
    return this.blogService.create(dto, tenantId, userId);
  }

  @Put(':id')
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  update(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string | null | undefined,
    @Body() dto: UpdateBlogPostDto,
  ): Promise<BlogPostResponseDto> {
    return this.blogService.update(id, dto, tenantId);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  remove(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string | null | undefined,
  ): Promise<void> {
    return this.blogService.delete(id, tenantId);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string | null | undefined,
  ): Promise<BlogPostResponseDto> {
    return this.blogService.findOne(id, tenantId);
  }

  @Get()
  findAll(
    @CurrentUser('tenantId') tenantId: string | null | undefined,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<{ data: BlogPostResponseDto[]; total: number }> {
    return this.blogService.findAll(
      tenantId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10,
      false, // Show both published and draft posts to admins
    );
  }
}
