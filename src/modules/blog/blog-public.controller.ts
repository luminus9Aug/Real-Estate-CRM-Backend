import { Controller, Get, Param, Query, Headers, NotFoundException } from '@nestjs/common';
import { BlogService } from './blog.service';
import { BlogPostResponseDto } from './dto/blog-response.dto';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('blog')
@Public()
export class BlogPublicController {
  constructor(
    private readonly blogService: BlogService,
    private readonly prisma: PrismaService,
  ) {}

  private async getTenant(host?: string) {
    if (host && host.includes('.')) {
      const subdomain = host.split('.')[0];
      if (subdomain && subdomain !== 'www' && subdomain !== 'localhost' && subdomain !== '127') {
        const tenant = await this.prisma.tenant.findUnique({
          where: { subdomain },
        });
        if (tenant) return tenant;
      }
    }
    // Fallback: get the first active tenant in the system (e.g. standard seeded tenant)
    const firstTenant = await this.prisma.tenant.findFirst({
      where: { isActive: true },
    });
    if (!firstTenant) {
      throw new NotFoundException('No active tenant found.');
    }
    return firstTenant;
  }

  @Get()
  async findAll(
    @Headers('host') host: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<{ data: BlogPostResponseDto[]; total: number }> {
    const tenant = await this.getTenant(host);
    return this.blogService.findAll(
      tenant.id,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10,
      true, // Only show published posts to the public
    );
  }

  @Get(':slug')
  async findOneBySlug(
    @Param('slug') slug: string,
    @Headers('host') host: string,
  ): Promise<BlogPostResponseDto> {
    const tenant = await this.getTenant(host);
    return this.blogService.findOneBySlug(slug, tenant.id);
  }
}
