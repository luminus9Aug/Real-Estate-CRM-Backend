export class BlogPostResponseDto {
  id!: string;
  tenantId!: string;
  authorId!: string;
  title!: string;
  slug!: string;
  excerpt!: string | null;
  content!: string;
  coverImage!: string | null;
  metaTitle!: string | null;
  metaDescription!: string | null;
  tags!: string[];
  isPublished!: boolean;
  publishedAt!: Date | null;
  viewCount!: number;
  createdAt!: Date;
  updatedAt!: Date;
  author?: {
    name: string;
    avatarUrl: string | null;
  };
}
