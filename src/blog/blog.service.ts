/* eslint-disable @typescript-eslint/no-unsafe-assignment */

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

  async getAllAdmin(params: {
    category: string | null;
    page: number;
    limit: number;
    search: string;
    published: boolean | null;
  }) {
    const { category, page, limit, search, published } = params;

    const skip = (page - 1) * limit;

    const where: any = {
      ...(published !== null && { published }),

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

    const [blogs, total, totalPublished, totalDraft] = await Promise.all([
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
      this.prisma.blogPost.count({ where: { published: true } }),
      this.prisma.blogPost.count({ where: { published: false } }),
    ]);

    return {
      data: blogs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      summary: {
        total: totalPublished + totalDraft,
        published: totalPublished,
        draft: totalDraft,
      },
    };
  }

  async createBlog(dto: CreateBlogDto, adminId: number) {
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
    const categories = await this.prisma.blogCategory.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    });

    return categories;
  }

  async getBlogById(id: number) {
    const blog = await this.prisma.blogPost.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        subCategories: {
          include: {
            subCategory: { select: { id: true, name: true, slug: true } },
          },
        },
        tags: { include: { tag: { select: { id: true, name: true } } } },
      },
    });

    if (!blog) throw new NotFoundException(`Blog post #${id} not found`);

    return {
      ...blog,
      subCategories: blog.subCategories.map((sc) => sc.subCategory),
      tags: blog.tags.map((t) => t.tag),
    };
  }

  async updateBlog(id: number, dto: UpdateBlogDto, adminId: number) {
    const existing = await this.prisma.blogPost.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Blog post #${id} not found`);

    if (dto.slug && dto.slug !== existing.slug) {
      const slugTaken = await this.prisma.blogPost.findUnique({
        where: { slug: dto.slug },
      });
      if (slugTaken)
        throw new ConflictException(
          'A blog post with this slug already exists',
        );
    }

    if (dto.blogCategoryId !== undefined) {
      const category = await this.prisma.blogCategory.findUnique({
        where: { id: dto.blogCategoryId },
      });
      if (!category) throw new BadRequestException('Category not found');
    }

    const blog = await this.prisma.blogPost.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.slug !== undefined && { slug: dto.slug }),
        ...(dto.content !== undefined && { content: dto.content }),
        ...(dto.image !== undefined && { image: dto.image }),
        ...(dto.published !== undefined && { published: dto.published }),
        ...(dto.blogCategoryId !== undefined && {
          category: { connect: { id: dto.blogCategoryId } },
        }),
        ...(dto.selectedSubCategoryIds !== undefined && {
          subCategories: {
            deleteMany: {},
            create: dto.selectedSubCategoryIds.map((scId) => ({
              subCategoryId: Number(scId),
            })),
          },
        }),
      },
      include: {
        category: true,
        subCategories: { include: { subCategory: true } },
      },
    });

    await this.activityLogService.log({
      adminId,
      action: 'UPDATE_BLOG',
      module: 'CONTENT',
      targetId: blog.id,
      targetLabel: blog.title,
      newValue: {
        title: blog.title,
        slug: blog.slug,
        published: blog.published,
        categoryId: blog.categoryId,
      },
    });

    return blog;
  }

  async deleteBlog(id: number, adminId: number) {
    const existing = await this.prisma.blogPost.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Blog post #${id} not found`);

    await this.prisma.blogPost.delete({ where: { id } });

    await this.activityLogService.log({
      adminId,
      action: 'DELETE_BLOG',
      module: 'CONTENT',
      targetId: id,
      targetLabel: existing.title,
      newValue: { title: existing.title, slug: existing.slug },
    });

    return { message: 'Blog post deleted successfully' };
  }

  async getBlogBySlug(slug: string) {
    return this.findBlogBySlug(slug, true);
  }

  async getBlogBySlugAdmin(slug: string) {
    return this.findBlogBySlug(slug, false);
  }

  private async findBlogBySlug(slug: string, publishedOnly: boolean) {
    const blog = await this.prisma.blogPost.findFirst({
      where: publishedOnly ? { slug, published: true } : { slug },
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
