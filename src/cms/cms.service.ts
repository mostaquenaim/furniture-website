/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-constant-binary-expression */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
import { CreateMaterialDto } from './dto/create-material.dto';
import districtsData from 'src/cms/data/districtData';
import couponsData from './data/couponData';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { CouponDiscountType, Prisma } from '@prisma/client';
import { UpdateDistrictDto } from './dto/update-district.dto';
import { CreateDistrictDto } from './dto/create-district.dto';
import { UpdateColorDto } from './dto/update-color.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { UpdateSizeDto } from './dto/update-size.dto';

@Injectable()
export class CmsService {
  constructor(private prisma: PrismaService) {}

  private about = { content: '' };
  private tnc = { content: '' };
  private banners = [];

  // get all tags
  async getAllTags(search?: string, limit?: number) {
    return await this.prisma.tag.findMany({
      where: {
        isActive: true,
        ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
      },
      select: {
        id: true,
        name: true,
      },
      take: limit ?? undefined,
      orderBy: {
        name: 'asc',
      },
    });
  }

  // create new tag
  async createNewTag(name: string) {
    const existing = await this.prisma.tag.findUnique({
      where: { name: name.toLowerCase() },
    });

    if (existing) return existing;

    return this.prisma.tag.create({
      data: { name: name.toLowerCase() },
    });
  }

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
        isActive: dto.isActive ?? true,
      },
    });
  }

  // DELETE COLOR
  async deleteColor(userId: number, id: number) {
    // check if color exists
    const color = await this.prisma.color.findUnique({
      where: { id },
    });
    if (!color) {
      throw new NotFoundException('Color not found');
    }

    // check if any product uses this color
    const usedInProducts = await this.prisma.productColor.count({
      where: { colorId: id },
    });

    if (usedInProducts > 0) {
      throw new BadRequestException(
        'Cannot delete this color. It is used in one or more products.',
      );
    }

    // safe to delete
    return this.prisma.color.delete({
      where: { id },
    });
  }

  // DELETE MATERIAL
  async deleteMaterial(userId: number, id: number) {
    // check if material exists
    const material = await this.prisma.material.findUnique({
      where: { id },
    });
    if (!material) {
      throw new NotFoundException('Material not found');
    }

    // check if any product uses this color
    const usedInProducts = await this.prisma.product.count({
      where: { materialId: id },
    });

    if (usedInProducts > 0) {
      throw new BadRequestException(
        'Cannot delete this material. It is used in one or more products.',
      );
    }

    // safe to delete
    return this.prisma.material.delete({
      where: { id },
    });
  }

  // DELETE SIZE
  async deleteSize(userId: number, id: number) {
    // Check if size exists
    const size = await this.prisma.size.findUnique({
      where: { id },
    });

    if (!size) {
      throw new NotFoundException('Size not found');
    }

    // Check if any product uses this size
    const usedInProducts = await this.prisma.productSize.count({
      where: { sizeId: id },
    });

    if (usedInProducts > 0) {
      throw new BadRequestException(
        'Cannot delete this size. It is used in one or more products.',
      );
    }

    // Safe to delete
    return this.prisma.size.delete({
      where: { id },
    });
  }

  // UPDATE COLOR
  async updateColor(userId: number, id: number, colorDto: UpdateColorDto) {
    const existing = await this.prisma.color.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Color not found');
    }

    return this.prisma.color.update({
      where: { id },
      data: colorDto,
    });
  }

  // UPDATE Size
  async updateSize(userId: number, id: number, sizeDto: UpdateSizeDto) {
    try {
      return await this.prisma.size.update({
        where: { id },
        data: sizeDto,
      });
    } catch (error) {
      throw new NotFoundException('Size not found');
    }
  }

  // UPDATE MATERIAL
  async updateMaterial(
    userId: number,
    id: number,
    materialDto: UpdateMaterialDto,
  ) {
    const existing = await this.prisma.material.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Material not found');
    }

    return this.prisma.material.update({
      where: { id },
      data: {
        ...materialDto,
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

  // MATERIAL ATTRIBUTE
  async addMaterial(dto: CreateMaterialDto) {
    // Check uniqueness by name
    const existing = await this.prisma.material.findFirst({
      where: { name: dto.name },
    });

    if (existing) {
      throw new ConflictException('Material with this name already exists');
    }

    return this.prisma.material.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        order: dto.order ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  getAllVariants() {
    return this.prisma.variant.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  // READ (Active only)
  getVariants(isActive?: boolean | null, parsedSize?: boolean) {
    return this.prisma.variant.findMany({
      where: isActive === null ? {} : { isActive: isActive ?? true },
      orderBy: { sortOrder: 'asc' },
      include: parsedSize
        ? {
            sizes: { orderBy: { sortOrder: 'asc' } },
          }
        : {},
    });
  }

  // get all colors
  getAllColors(isActive?: boolean | null) {
    return this.prisma.color.findMany({
      where: isActive === null ? {} : { isActive: isActive ?? true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  // get all sizes
  getSizes(isActive?: boolean | null) {
    return this.prisma.size.findMany({
      where: isActive === null ? {} : { isActive: isActive ?? true },
      orderBy: { sortOrder: 'asc' },
      include: {
        variant: true,
      },
    });
  }

  // get all materials
  getAllMaterials(isActive?: boolean | null) {
    return this.prisma.material.findMany({
      where: isActive === null ? {} : { isActive: isActive ?? true },
      orderBy: { order: 'asc' },
    });
  }

  // get all districts
  async getDistricts() {
    return await this.prisma.district.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        deliveryFee: true,
        isCODAvailable: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  // create initial district data
  async createInitialDistrict(userId: number) {
    for (const district of districtsData) {
      // Remove trailing spaces from names
      const cleanName = district.name.trim();

      // Check if district already exists
      const existingDistrict = await this.prisma.district.findUnique({
        where: { name: cleanName },
      });

      if (!existingDistrict) {
        await this.prisma.district.create({
          data: {
            name: cleanName,
            deliveryFee: Number(process.env.DEFAULT_DELIVERY_FEE) || 120,
          },
        });
        console.log(`Created district: ${cleanName}`);
      } else {
        console.log(`District already exists: ${cleanName}`);
      }
    }
  }

  // create district data
  async createDistrict(userId: number, districtDto: CreateDistrictDto) {
    const cleanName = districtDto.name.trim();

    // Check if district already exists
    const existingDistrict = await this.prisma.district.findUnique({
      where: { name: cleanName },
    });

    if (existingDistrict) {
      throw new BadRequestException('District already exists');
    }

    const district = await this.prisma.district.create({
      data: {
        name: cleanName,
        deliveryFee:
          districtDto.deliveryFee ??
          Number(process.env.DEFAULT_DELIVERY_FEE) ??
          120,
        isCODAvailable: districtDto.isCODAvailable ?? true,
      },
    });

    return district;
  }

  // delete district
  async deleteDistrict(userId: number, id: number) {
    return this.prisma.district.delete({
      where: { id },
    });
  }

  // update districts
  async updateDistrict(id: number, data: UpdateDistrictDto) {
    const existing = await this.prisma.district.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('District not found');
    }

    return this.prisma.district.update({
      where: { id },
      data,
    });
  }

  //create coupons mock
  async createMockCoupons() {
    for (const couponData of couponsData) {
      await this.prisma.coupon.create({
        data: couponData,
      });
    }
  }

  // create a coupon
  async createCoupon(dto: CreateCouponDto) {
    // Validate discountValue for percentage/fixed coupons
    if (
      (dto.discountType === CouponDiscountType.PERCENTAGE ||
        dto.discountType === CouponDiscountType.FIXED_AMOUNT) &&
      (dto.discountValue === undefined || dto.discountValue === null)
    ) {
      throw new BadRequestException(
        'discountValue is required for PERCENTAGE or FIXED coupon type',
      );
    }

    const start = dto.startDate ?? new Date();
    if (dto.expiryDate <= start) {
      throw new BadRequestException('expiryDate must be after startDate');
    }

    try {
      const coupon = await this.prisma.coupon.create({
        data: {
          code: dto.code,
          discountType: dto.discountType,
          discountValue: dto.discountValue ?? null,
          minOrderValue: dto.minOrderValue ?? null,
          maxDiscount: dto.maxDiscount ?? null,
          startDate: start,
          expiryDate: dto.expiryDate,
          isActive: dto.isActive ?? true,
        },
      });

      return coupon;
    } catch (error) {
      // Prisma unique constraint violation error
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(
          `Coupon code "${dto.code}" already exists`,
        );
      }
      throw error;
    }
  }
}
