import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBlogPostDto, UpdateBlogPostDto } from './dto/create-blog.dto';
import { BlogPostResponseDto } from './dto/blog-response.dto';

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

@Injectable()
export class BlogService {
  constructor(private readonly prisma: PrismaService) {}

  private mapToResponseDto(post: any): BlogPostResponseDto {
    return {
      id: post.id,
      tenantId: post.tenantId,
      authorId: post.authorId,
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      content: post.content,
      coverImage: post.coverImage,
      metaTitle: post.metaTitle,
      metaDescription: post.metaDescription,
      tags: post.tags,
      isPublished: post.isPublished,
      publishedAt: post.publishedAt,
      viewCount: post.viewCount,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      author: post.author ? {
        name: post.author.name,
        avatarUrl: post.author.avatarUrl,
      } : undefined,
    };
  }

  private async getFallbackTenantId(tenantId?: string | null): Promise<string> {
    if (tenantId) {
      return tenantId;
    }
    const activeTenant = await this.prisma.tenant.findFirst({
      where: { isActive: true },
    });
    if (!activeTenant) {
      throw new BadRequestException('No active tenant found.');
    }
    return activeTenant.id;
  }

  async create(
    dto: CreateBlogPostDto,
    tenantId: string | null | undefined,
    authorId: string,
  ): Promise<BlogPostResponseDto> {
    const targetTenantId = await this.getFallbackTenantId(tenantId);
    const slug = slugify(dto.title);

    // Verify slug uniqueness within the tenant
    const existing = await this.prisma.blogPost.findUnique({
      where: {
        tenantId_slug: { tenantId: targetTenantId, slug },
      },
    });

    if (existing) {
      throw new BadRequestException('A blog post with this title already exists.');
    }

    const post = await this.prisma.blogPost.create({
      data: {
        tenantId: targetTenantId,
        authorId,
        title: dto.title,
        slug,
        excerpt: dto.excerpt,
        content: dto.content,
        coverImage: dto.coverImage,
        metaTitle: dto.metaTitle || dto.title,
        metaDescription: dto.metaDescription || dto.excerpt || '',
        tags: dto.tags || [],
        isPublished: dto.isPublished || false,
        publishedAt: dto.isPublished ? new Date() : null,
      },
      include: {
        author: true,
      },
    });

    return this.mapToResponseDto(post);
  }

  async update(
    id: string,
    dto: UpdateBlogPostDto,
    tenantId: string | null | undefined,
  ): Promise<BlogPostResponseDto> {
    const where: any = { id };
    if (tenantId) {
      where.tenantId = tenantId;
    }

    const existing = await this.prisma.blogPost.findFirst({
      where,
    });

    if (!existing) {
      throw new NotFoundException('Blog post not found.');
    }

    const updateData: any = { ...dto };
    if (dto.title && dto.title !== existing.title) {
      updateData.slug = slugify(dto.title);

      const duplicate = await this.prisma.blogPost.findFirst({
        where: {
          tenantId: existing.tenantId,
          slug: updateData.slug,
          id: { not: id },
        },
      });

      if (duplicate) {
        throw new BadRequestException('A blog post with this title already exists.');
      }
    }

    if (dto.isPublished !== undefined && dto.isPublished !== existing.isPublished) {
      updateData.publishedAt = dto.isPublished ? new Date() : null;
    }

    const updated = await this.prisma.blogPost.update({
      where: { id },
      data: updateData,
      include: {
        author: true,
      },
    });

    return this.mapToResponseDto(updated);
  }

  async delete(id: string, tenantId: string | null | undefined): Promise<void> {
    const where: any = { id };
    if (tenantId) {
      where.tenantId = tenantId;
    }

    const existing = await this.prisma.blogPost.findFirst({
      where,
    });

    if (!existing) {
      throw new NotFoundException('Blog post not found.');
    }

    await this.prisma.blogPost.delete({
      where: { id },
    });
  }

  async findOne(id: string, tenantId: string | null | undefined): Promise<BlogPostResponseDto> {
    const where: any = { id };
    if (tenantId) {
      where.tenantId = tenantId;
    }

    const post = await this.prisma.blogPost.findFirst({
      where,
      include: {
        author: true,
      },
    });

    if (!post) {
      throw new NotFoundException('Blog post not found.');
    }

    return this.mapToResponseDto(post);
  }

  async findAll(
    tenantId: string | null | undefined,
    page: number = 1,
    limit: number = 10,
    isPublishedOnly: boolean = false,
  ): Promise<{ data: BlogPostResponseDto[]; total: number }> {
    const where: any = {};
    if (tenantId) {
      where.tenantId = tenantId;
    }
    if (isPublishedOnly) {
      where.isPublished = true;
    }

    const [posts, total] = await this.prisma.$transaction([
      this.prisma.blogPost.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          author: true,
        },
      }),
      this.prisma.blogPost.count({ where }),
    ]);

    return {
      data: posts.map((p) => this.mapToResponseDto(p)),
      total,
    };
  }

  async findOneBySlug(slug: string, tenantId: string | null | undefined): Promise<BlogPostResponseDto> {
    const targetTenantId = await this.getFallbackTenantId(tenantId);
    const post = await this.prisma.blogPost.findUnique({
      where: {
        tenantId_slug: { tenantId: targetTenantId, slug },
      },
      include: {
        author: true,
      },
    });

    if (!post || !post.isPublished) {
      throw new NotFoundException('Blog post not found.');
    }

    // Async increment views without blocking
    this.prisma.blogPost
      .update({
        where: { id: post.id },
        data: { viewCount: { increment: 1 } },
      })
      .catch(() => {});

    return this.mapToResponseDto(post);
  }
}
