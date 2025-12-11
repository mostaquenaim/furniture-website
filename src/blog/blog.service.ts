/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Injectable } from '@nestjs/common';
import { CreateBlogDto } from './dto/create-blog.dto';
import { UpdateBlogDto } from './dto/update-blog.dto';

@Injectable()
export class BlogsService {
  private blogs = [];

  getAll() {
    return this.blogs;
  }

  create(dto: CreateBlogDto) {
    console.log(dto);
    // const blog = {
    //   id: Date.now(),
    //   products: dto.productIds || [],
    //   ...dto,
    // };

    // this.blogs.push(blog);
    // return blog;
  }

  getBySlug(slug: string) {
    console.log(slug);
    // return this.blogs.find((b) => b.slug === slug);
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
