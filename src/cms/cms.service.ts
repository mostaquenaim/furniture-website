/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { ConflictException, Injectable } from '@nestjs/common';
import { CreateAboutDto } from './dto/create-about.dto';
import { UpdateAboutDto } from './dto/update-about.dto';
import { CreateTnCDto } from './dto/create-tnc.dto';
import { UpdateTnCDto } from './dto/update-tnc.dto';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';
import { CreatePromoBannerDto } from './dto/create-promo-banner.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdatePromoBannerDto } from './dto/update-promo-banner.dto';
import { CreateColorDto } from './dto/create-color.dto';
import { CreateSizeDto } from './dto/create-size-dto.dto';
import { CreateVariantDto } from './dto/create-variant.dto';

@Injectable()
export class CmsService {
  constructor(private prisma: PrismaService) {}

  private about = { content: '' };
  private tnc = { content: '' };
  private banners = [];

  // About
  getAbout() {
    return this.about;
  }
  createAbout(dto: CreateAboutDto) {
    this.about = dto;
    return this.about;
  }
  updateAbout(dto: UpdateAboutDto) {
    this.about = { ...this.about, ...dto };
    return this.about;
  }

  // T&C
  getTnC() {
    return this.tnc;
  }
  createTnC(dto: CreateTnCDto) {
    this.tnc = dto;
    return this.tnc;
  }
  updateTnC(dto: UpdateTnCDto) {
    this.tnc = { ...this.tnc, ...dto };
    return this.tnc;
  }

  // Banners
  getBanners() {
    return this.banners;
  }
  createBanner(dto: CreateBannerDto) {
    console.log(dto);
    // const banner = { id: Date.now(), ...dto };
    // this.banners.push(banner);
    // return banner;
  }
  updateBanner(id: string, dto: UpdateBannerDto) {
    console.log(id, dto);
    // const idx = this.banners.findIndex(b => b.id == id);
    // if (idx === -1) return null;

    // this.banners[idx] = { ...this.banners[idx], ...dto };
    // return this.banners[idx];
  }
  deleteBanner(id: string) {
    console.log(id);
    // this.banners = this.banners.filter(b => b.id != id);
    // return { message: 'Banner deleted' };
  }

  // CREATE
  createPromoBanner(dto: CreatePromoBannerDto) {
    // console.log(dto,'dtoservice');
    return this.prisma.promoBanner.create({
      data: {
        text: dto.text,
        bgColor: dto.bgColor,
        order: dto.order ?? 0,
        isActive: dto.isActive ?? true,
        links: {
          create: dto.links.map((l) => ({
            text: l.text,
            url: l.url,
          })),
        },
      },
      include: { links: true },
    });
  }

  // READ (Active only)
  findAllActivePromoBanners() {
    return this.prisma.promoBanner.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      include: { links: true },
    });
  }

  // UPDATE (transaction-safe)
  async updatePromoBanner(id: number, dto: UpdatePromoBannerDto) {
    return this.prisma.$transaction(async (tx) => {
      if (dto.links) {
        await tx.promoBannerLink.deleteMany({
          where: { bannerId: id },
        });
      }

      return tx.promoBanner.update({
        where: { id },
        data: {
          text: dto.text,
          bgColor: dto.bgColor,
          order: dto.order,
          isActive: dto.isActive,
          links: dto.links
            ? {
                create: dto.links.map((l) => ({
                  text: l.text,
                  url: l.url,
                })),
              }
            : undefined,
        },
        include: { links: true },
      });
    });
  }

  // DELETE
  removePromoBanner(id: number) {
    return this.prisma.promoBanner.delete({
      where: { id },
    });
  }

  // COLOR ATTRIBUTE
  async createColor(dto: CreateColorDto) {
    // Prevent duplicate colors (hex should be unique logically)
    const existing = await this.prisma.color.findFirst({
      where: {
        hexCode: dto.hexCode,
      },
    });

    if (existing) {
      throw new ConflictException('Color with this hex code already exists');
    }

    return this.prisma.color.create({
      data: {
        name: dto.name,
        hexCode: dto.hexCode,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  // SIZE ATTRIBUTE
  async createSize(dto: CreateSizeDto) {
    // Check uniqueness by name within the same variant
    const existing = await this.prisma.size.findFirst({
      where: {
        name: dto.name,
        variantId: dto.variantId, // ensures name is unique per variant
      },
    });

    if (existing) {
      throw new ConflictException(
        'Size with this name already exists for this variant',
      );
    }

    return this.prisma.size.create({
      data: {
        name: dto.name,
        variantId: dto.variantId, // always defined
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  getAllSizes() {
    return this.prisma.size.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  // VARIANT ATTRIBUTE
  async createVariant(dto: CreateVariantDto) {
    // Check uniqueness by name
    const existing = await this.prisma.variant.findFirst({
      where: { name: dto.name },
    });

    if (existing) {
      throw new ConflictException('Variant with this name already exists');
    }

    return this.prisma.variant.create({
      data: {
        name: dto.name,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  getAllVariants() {
    return this.prisma.variant.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  // READ (Active only)
  getVariants() {
    return this.prisma.variant.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        sizes: { orderBy: { sortOrder: 'asc' } },
      },
    });
  }

  getAllColors() {
    return this.prisma.color.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      // include: { links: true },
    });
  }
}
