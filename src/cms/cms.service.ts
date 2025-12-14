/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { CreateAboutDto } from './dto/create-about.dto';
import { UpdateAboutDto } from './dto/update-about.dto';
import { CreateTnCDto } from './dto/create-tnc.dto';
import { UpdateTnCDto } from './dto/update-tnc.dto';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';
import { CreatePromoBannerDto } from './dto/create-promo-banner.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdatePromoBannerDto } from './dto/update-promo-banner.dto';

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
}
