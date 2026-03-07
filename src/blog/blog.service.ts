/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  BadRequestException,
  ConflictException,
  Injectable,
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

  getAll() {
    return this.blogs;
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

  getBySlug(slug: string) {
    console.log(slug);
    // return this.blogs.find((b) => b.slug === slug);
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

  update(id: string, dto: UpdateBlogDto) {
    console.log(id, dto);
    // const idx = this.blogs.findIndex((b) => b.id == id);
    // if (idx === -1) return null;

    // this.blogs[idx] = { ...this.blogs[idx], ...dto };
    // return this.blogs[idx];
  }

  delete(id: string) {
    console.log(id);
    // this.blogs = this.blogs.filter((b) => b.id != id);
    // return { message: 'Blog deleted' };
  }

  getProducts(id: string) {
    console.log(id);
    // const blog = this.blogs.find((b) => b.id == id);
    // return blog?.products || [];
  }

  linkProducts(id: string, productIds: string[]) {
    console.log(id, productIds);
    // const blog = this.blogs.find((b) => b.id == id);
    // if (!blog) return null;

    // blog.products.push(...productIds);
    // return blog;
  }
}
