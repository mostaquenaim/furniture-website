/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateBlogDto } from './dto/create-blog.dto';
import { UpdateBlogDto } from './dto/update-blog.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateBlogCategoryDto } from './dto/create-blog-category.dto';
import { ActivityLogService } from 'src/activity-log/activity-log.service';

@Injectable()
export class BlogsService {
  constructor(
    private prisma: PrismaService,
    private activityLogService: ActivityLogService,
  ) {}

  private blogs = [];

  async getAll(params: {
    category: string | null;
    page: number;
    limit: number;
    search: string;
  }) {
    const { category, page, limit, search } = params;

    const skip = (page - 1) * limit;

    const where: any = {
      published: true,

      ...(category && {
        category: {
          slug: category,
        },
      }),

      ...(search && {
        OR: [
          {
            title: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            content: {
              contains: search,
              mode: 'insensitive',
            },
          },
        ],
      }),
    };

    const [blogs, total] = await Promise.all([
      this.prisma.blogPost.findMany({
        where,
        skip,
        take: limit,

        include: {
          category: true,

          subCategories: {
            include: {
              subCategory: true,
            },
          },

          tags: {
            include: {
              tag: true,
            },
          },
        },

        orderBy: {
          createdAt: 'desc',
        },
      }),

      this.prisma.blogPost.count({ where }),
    ]);

    return {
      data: blogs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async createBlog(dto: CreateBlogDto, adminId: number) {
    console.log(dto);
    // Check duplicate blog slug
    const existingBlog = await this.prisma.blogPost.findUnique({
      where: { slug: dto.slug },
    });

    if (existingBlog) {
      throw new ConflictException('Blog with this slug already exists');
    }

    // Find or create blog category
    const category = await this.prisma.blogCategory.findUnique({
      where: { id: dto.blogCategoryId },
    });

    if (!category) {
      throw new BadRequestException('Category not found');
    }

    // Create blog post
    const blog = await this.prisma.blogPost.create({
      data: {
        title: dto.title,
        slug: dto.slug,
        content: dto.content,
        image: dto.image ?? null,
        published: dto.published ?? false,

        // Category (mandatory)
        category: {
          connect: { id: category.id },
        },

        // Subcategories (many-to-many)
        subCategories: dto.selectedSubCategoryIds?.length
          ? {
              create: dto.selectedSubCategoryIds.map((id) => ({
                subCategoryId: Number(id),
              })),
            }
          : undefined,
      },
      include: {
        category: true,
        subCategories: {
          include: { subCategory: true },
        },
      },
    });

    await this.activityLogService.log({
      adminId,
      action: 'CREATE_BLOG',
      module: 'CONTENT',
      targetId: blog.id,
      targetLabel: blog.title,
      newValue: {
        title: blog.title,
        slug: blog.slug,
        content: blog.content,
        categoryId: blog.categoryId,
        published: blog.published,
      },
    });

    return blog;
  }

  async createBlogCategory(dto: CreateBlogCategoryDto, adminId: number) {
    const { name, slug: inputSlug, order = 0, isActive = true } = dto;

    // Auto-generate slug if not provided
    const slug =
      inputSlug ||
      name
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();

    // Check for duplicates
    const existing = await this.prisma.blogCategory.findUnique({
      where: { slug },
    });

    if (existing) {
      throw new BadRequestException('Category with this name already exists');
    }

    // Create category
    const category = await this.prisma.blogCategory.create({
      data: {
        name,
        slug,
        order,
        isActive,
      },
    });

    await this.activityLogService.log({
      adminId,
      action: 'CREATE_BLOGCATEGORY',
      module: 'CONTENT',
      targetId: category.id,
      targetLabel: category.name,
      newValue: {
        slug: category.slug,
        name: category.name,
      },
    });

    return category;
  }

  async getCategories() {
    console.log('here it goes');
    const categories = await this.prisma.blogCategory.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    });

    console.log(categories);
    return categories;
  }

  async getBlogBySlug(slug: string) {
    const blog = await this.prisma.blogPost.findUnique({
      where: {
        slug,
      },
      include: {
        // Include the primary category
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        // Include Many-to-Many Subcategories through the join table
        subCategories: {
          include: {
            subCategory: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
        // Include Many-to-Many Tags through the join table
        tags: {
          include: {
            tag: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!blog) {
      throw new NotFoundException(`Blog post with slug "${slug}" not found`);
    }

    // Professional touch: Flatten the relational structure for the frontend
    return {
      ...blog,
      subCategories: blog.subCategories.map((sc) => sc.subCategory),
      tags: blog.tags.map((t) => t.tag),
    };
  }
}
