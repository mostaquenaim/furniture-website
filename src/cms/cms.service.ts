/* eslint-disable @typescript-eslint/no-floating-promises */
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
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateAboutDto } from './dto/create-about.dto';
import { UpdateAboutDto } from './dto/update-about.dto';
import { CreateTnCDto } from './dto/create-tnc.dto';
import { UpdateTnCDto } from './dto/update-tnc.dto';
import { UpdateBannerDto } from './dto/Banner/update-banner.dto';
import { CreatePromoBannerDto } from './dto/Banner/create-promo-banner.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdatePromoBannerDto } from './dto/Banner/update-promo-banner.dto';
import { CreateColorDto } from './dto/create-color.dto';
import { CreateSizeDto } from './dto/create-size-dto.dto';
import { CreateVariantDto } from './dto/create-variant.dto';
import { CreateMaterialDto } from './dto/create-material.dto';
import districtsData from 'src/cms/data/districtData';
import couponsData from './data/couponData';
import { CreateCouponDto } from './dto/Coupon/create-coupon.dto';
import { Banner, CouponDiscountType, Prisma } from '@prisma/client';
import { UpdateDistrictDto } from './dto/update-district.dto';
import { CreateDistrictDto } from './dto/create-district.dto';
import { UpdateColorDto } from './dto/update-color.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { UpdateSizeDto } from './dto/update-size.dto';
import { UpdateVariantDto } from './dto/update-variant.dto';
import { ActivityLogService } from 'src/activity-log/activity-log.service';
import { GetCouponsQueryDto } from './dto/Coupon/get-coupon-query.dto';
import { UpdateCouponDto } from './dto/Coupon/update-coupon.dto';
import { CreateBannerDto } from './dto/Banner/create-banner.dto';

@Injectable()
export class CmsService {
  private readonly logger = new Logger(CmsService.name);

  constructor(
    private prisma: PrismaService,
    private activityLogService: ActivityLogService,
  ) {}

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
  async createNewTag(name: string, adminId: number) {
    const existing = await this.prisma.tag.findUnique({
      where: { name: name.toLowerCase() },
    });

    if (existing) return existing;

    const tag = await this.prisma.tag.create({
      data: { name: name.toLowerCase() },
    });

    await this.activityLogService.log({
      adminId,
      action: 'CREATE_TAG',
      module: 'PRODUCT',
      targetId: tag.id,
      targetLabel: tag.name,
      newValue: {
        name: tag.name,
      },
    });

    return tag;
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
  updateBanner(id: string, dto: UpdateBannerDto) {
  // console.log(id, dto);
    // const idx = this.banners.findIndex(b => b.id == id);
    // if (idx === -1) return null;

    // this.banners[idx] = { ...this.banners[idx], ...dto };
    // return this.banners[idx];
  }
  deleteBanner(id: string) {
  // console.log(id);
    // this.banners = this.banners.filter(b => b.id != id);
    // return { message: 'Banner deleted' };
  }

  getHomepageBanners(isActive?: boolean, device?: 'DESKTOP' | 'MOBILE') {
    return this.prisma.banner.findMany({
      where: {
        ...(typeof isActive === 'boolean' && { active: isActive }),
        ...(device && {
          OR: [
            { device }, // specific device
            { device: null }, // common banners
          ],
        }),
      },
      orderBy: { id: 'asc' },
    });
  }

  // CREATE
  async createPromoBanner(dto: CreatePromoBannerDto, adminId: number) {
    // console.log(dto,'dtoservice');
    const promoBanner = await this.prisma.promoBanner.create({
      data: {
        text: dto.text,
        title: dto.title,
        bgColor: dto.bgColor,
        order: dto.order ?? 0,
        isActive: dto.isActive ?? true,
        links: {
          create: dto?.links?.map((l) => ({
            text: l.text,
            url: l.url,
          })),
        },
      },
      include: { links: true },
    });

    this.activityLogService.log({
      adminId,
      action: 'CREATE_PROMO_BANNER',
      module: 'MARKETING',
      targetId: promoBanner.id,
      targetLabel: promoBanner.title || '',
      newValue: {
        isActive: promoBanner.isActive,
        text: promoBanner.text,
        bgColor: promoBanner.bgColor,
      },
    });

    return promoBanner;
  }

  // CREATE BANNER
  async createHomepageBanner(
    dto: CreateBannerDto,
    adminId: number,
  ): Promise<Banner> {
    const device = dto.device || 'DESKTOP';
    const shouldBeActive = dto.active ?? true;

    return await this.prisma.$transaction(async (tx) => {
      // deactivate existing active banner for this device
      if (shouldBeActive) {
        await tx.banner.updateMany({
          where: {
            active: true,
            device,
          },
          data: { active: false },
        });
      }

      const banner = await tx.banner.create({
        data: {
          title: dto.title,
          image: dto.image,
          link: dto.link,
          active: shouldBeActive,
          device,
        },
      });

      await this.activityLogService.log({
        adminId,
        action: 'CREATE_BANNER',
        module: 'MARKETING',
        targetId: banner.id,
        targetLabel: banner.title || '',
        newValue: {
          isActive: banner.active,
          title: banner.title,
          image: banner.image,
          link: banner.link,
          device: banner.device,
        },
      });

      return banner;
    });
  }

  // READ (Active only)
  findAllPromoBanners(isActive?: boolean) {
    return this.prisma.promoBanner.findMany({
      where: {
        ...(typeof isActive === 'boolean' && { isActive }),
      },
      orderBy: { order: 'asc' },
      include: { links: true },
    });
  }

  // UPDATE (transaction-safe)
  async updatePromoBanner(
    id: number,
    dto: UpdatePromoBannerDto,
    adminId: number,
  ) {
    const existing = await this.prisma.promoBanner.findUnique({
      where: {
        id,
      },
    });

    if (!existing) throw new NotFoundException('Promo Banner Not Found');

    return this.prisma.$transaction(async (tx) => {
      if (dto.links) {
        await tx.promoBannerLink.deleteMany({
          where: { bannerId: id },
        });
      }

      const updatedPromo = await tx.promoBanner.update({
        where: { id },
        data: {
          title: dto.title,
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

      this.activityLogService.log({
        adminId,
        action: 'UPDATE_PROMO',
        module: 'MARKETING',
        targetId: existing.id,
        targetLabel: '',
        oldValue: {
          text: existing.text,
          bgColor: existing.bgColor,
          isActive: existing.isActive,
          order: existing.order,
        },
        newValue: {
          text: updatedPromo.text,
          bgColor: updatedPromo.bgColor,
          isActive: updatedPromo.isActive,
          order: updatedPromo.order,
        },
      });

      return updatedPromo;
    });
  }

  //update homepage banner
  async updateHomepageBanner(id: number, dto: UpdateBannerDto, userId: number) {
    this.logger.log(`User ${userId} updating homepage banner ${id}`);

    const existing = await this.findBannerOrThrow(id);

    const device = dto.device ?? existing.device ?? 'DESKTOP';

    return await this.prisma.$transaction(async (tx) => {
      // if activating → deactivate others of same device
      if (dto.active === true) {
        await tx.banner.updateMany({
          where: {
            active: true,
            device,
            NOT: { id },
          },
          data: { active: false },
        });
      }

      return await tx.banner.update({
        where: { id },
        data: {
          ...(dto.title !== undefined && { title: dto.title.trim() }),
          ...(dto.image !== undefined && { image: dto.image.trim() }),
          ...(dto.link !== undefined && { link: dto.link?.trim() ?? null }),
          ...(dto.device !== undefined && { device: dto.device }),
          ...(dto.active !== undefined && { active: dto.active }),
        },
      });
    });
  }

  private async findPromoBannerOrThrow(id: number) {
    const banner = await this.prisma.promoBanner.findUnique({ where: { id } });
    if (!banner) throw new NotFoundException(`Promo banner #${id} not found`);
    return banner;
  }

  private async findBannerOrThrow(id: number) {
    const banner = await this.prisma.banner.findUnique({ where: { id } });
    if (!banner)
      throw new NotFoundException(`Homepage banner #${id} not found`);
    return banner;
  }

  private handlePrismaError(error: unknown, entity: string): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        const fields = (error.meta?.target as string[])?.join(', ');
        throw new ConflictException(
          `A ${entity} with this ${fields} already exists`,
        );
      }
      if (error.code === 'P2025') {
        throw new NotFoundException(`${entity} not found`);
      }
    }
    this.logger.error(
      `Unexpected error on ${entity}`,
      error instanceof Error ? error.stack : error,
    );
    throw new InternalServerErrorException(
      `Failed to process ${entity}. Please try again.`,
    );
  }

  // UPDATE COLOR
  async updateColor(userId: number, id: number, colorDto: UpdateColorDto) {
    const existing = await this.prisma.color.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Color not found');
    }

    const updatedColor = await this.prisma.color.update({
      where: { id },
      data: colorDto,
    });

    this.activityLogService.log({
      adminId: userId,
      action: 'UPDATE_COLOR',
      module: 'CATALOG',
      targetId: existing.id,
      targetLabel: existing.name,
      oldValue: {
        name: existing.name,
        hexCode: existing.hexCode,
        image: existing.image,
        isActive: existing.isActive,
        sortOrder: existing.sortOrder,
      },
      newValue: {
        name: updatedColor.name,
        hexCode: updatedColor.hexCode,
        image: updatedColor.image,
        isActive: updatedColor.isActive,
        sortOrder: updatedColor.sortOrder,
      },
    });

    return updatedColor;
  }

  // UPDATE Size
  async updateSize(userId: number, id: number, sizeDto: UpdateSizeDto) {
    try {
      const existing = await this.prisma.size.findUnique({
        where: {
          id,
        },
      });

      if (!existing) throw new NotFoundException('Size not found');

      const updateSize = await this.prisma.size.update({
        where: { id },
        data: sizeDto,
      });

      this.activityLogService.log({
        adminId: userId,
        action: 'UPDATE_SIZE',
        module: 'CATALOG',
        targetId: existing.id,
        targetLabel: existing.name,
        oldValue: {
          name: existing.name,
          isActive: existing.isActive,
          sortOrder: existing.sortOrder,
        },
        newValue: {
          name: updateSize.name,
          isActive: updateSize.isActive,
          sortOrder: updateSize.sortOrder,
        },
      });

      return updateSize;
    } catch (error) {
      throw new NotFoundException('Size not found');
    }
  }

  // UPDATE VARIANT
  async updateVariant(
    userId: number,
    id: number,
    variantDto: UpdateVariantDto,
  ) {
    try {
      const existing = await this.prisma.variant.findUnique({
        where: {
          id,
        },
      });

      if (!existing) throw new NotFoundException('Variant not found');

      const updatedVariant = await this.prisma.variant.update({
        where: { id },
        data: variantDto,
      });

      this.activityLogService.log({
        adminId: userId,
        action: 'UPDATE_VARIANT',
        module: 'CATALOG',
        targetId: existing.id,
        targetLabel: existing.name,
        oldValue: {
          name: existing.name,
          isActive: existing.isActive,
          sortOrder: existing.sortOrder,
        },
        newValue: {
          name: updatedVariant.name,
          isActive: updatedVariant.isActive,
          sortOrder: updatedVariant.sortOrder,
        },
      });

      return updatedVariant;
    } catch (error) {
      throw new NotFoundException('Variant not found');
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

    const updatedMaterial = await this.prisma.material.update({
      where: { id },
      data: {
        ...materialDto,
      },
    });

    this.activityLogService.log({
      adminId: userId,
      action: 'UPDATE_MATERIAL',
      module: 'CATALOG',
      targetId: existing.id,
      targetLabel: existing.name,
      oldValue: {
        name: existing.name,
        isActive: existing.isActive,
        sortOrder: existing.order,
      },
      newValue: {
        name: updatedMaterial.name,
        isActive: updatedMaterial.isActive,
        sortOrder: updatedMaterial.order,
      },
    });

    return updatedMaterial;
  }

  // update districts
  async updateDistrict(id: number, data: UpdateDistrictDto, adminId: number) {
    const existing = await this.prisma.city.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('District not found');
    }

    const updatedDistrict = await this.prisma.city.update({
      where: { id },
      data,
    });

    this.activityLogService.log({
      adminId,
      action: 'UPDATE_DISTRICT',
      module: 'SYSTEM',
      targetId: existing.id,
      targetLabel: '',
      oldValue: {
        name: existing.name,
        isActive: existing.isActive,
        deliveryFee: existing.deliveryFee,
        isCODAvailable: existing.isCODAvailable,
      },
      newValue: {
        name: updatedDistrict.name,
        isActive: updatedDistrict.isActive,
        deliveryFee: updatedDistrict.deliveryFee,
        isCODAvailable: updatedDistrict.isCODAvailable,
      },
    });

    return updatedDistrict;
  }

  // DELETE
  async removePromoBanner(id: number, adminId: number) {
    const existing = await this.prisma.promoBanner.findUnique({
      where: {
        id,
      },
    });

    if (!existing) throw new NotFoundException('Promo Banner Not Found');

    const deletedPromo = await this.prisma.promoBanner.delete({
      where: { id },
    });

    //activity log
    this.activityLogService.log({
      adminId: adminId,
      action: 'DELETE_PROMOTIONAL_BANNER',
      module: 'CATALOG',
      targetId: existing.id,
      targetLabel: '',
    });

    return deletedPromo;
  }

  // DELETE BANNER
  async removeHomepageBanner(id: number, adminId: number) {
    const existing = await this.prisma.banner.findUnique({
      where: {
        id,
      },
    });

    if (!existing) throw new NotFoundException('Banner Not Found');

    const deletedPromo = await this.prisma.banner.delete({
      where: { id },
    });

    //activity log
    this.activityLogService.log({
      adminId: adminId,
      action: 'DELETE_BANNER',
      module: 'CATALOG',
      targetId: existing.id,
      targetLabel: '',
    });

    return deletedPromo;
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
    const deleted = await this.prisma.color.delete({
      where: { id },
    });

    //activity log
    this.activityLogService.log({
      adminId: userId,
      action: 'DELETE_COLOR',
      module: 'CATALOG',
      targetId: color.id,
      targetLabel: color.name,
    });

    return deleted;
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
    const deletedMaterial = await this.prisma.material.delete({
      where: { id },
    });

    this.activityLogService.log({
      adminId: userId,
      action: 'DELETE_MATERIAL',
      module: 'CATALOG',
      targetId: material.id,
      targetLabel: material.name,
    });

    return deletedMaterial;
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
    const deletedSize = await this.prisma.size.delete({
      where: { id },
    });

    this.activityLogService.log({
      adminId: userId,
      action: 'DELETE_SIZE',
      module: 'CATALOG',
      targetId: size.id,
      targetLabel: size?.name || '',
    });

    return deletedSize;
  }

  // DELETE VARIANT
  async deleteVariant(userId: number, id: number) {
    // Check if variant exists
    const variant = await this.prisma.variant.findUnique({
      where: { id },
    });

    if (!variant) {
      throw new NotFoundException('Variant not found');
    }

    // Check if any product uses this variant
    const usedInProducts = await this.prisma.size.count({
      where: { variantId: id },
    });

    if (usedInProducts > 0) {
      throw new BadRequestException(
        'Cannot delete this variant. It is used in one or more sizes.',
      );
    }

    // Safe to delete
    const deleted = await this.prisma.variant.delete({
      where: { id },
    });

    //activity log
    this.activityLogService.log({
      adminId: userId,
      action: 'DELETE_VARIANT',
      module: 'CATALOG',
      targetId: variant.id,
      targetLabel: variant.name,
    });

    return deleted;
  }

  // delete city
  async deleteDistrict(userId: number, id: number) {
    const existing = await this.prisma.city.findUnique({
      where: {
        id,
      },
    });

    if (!existing) throw new NotFoundException('District not found');

    const deleted = await this.prisma.city.delete({
      where: { id },
    });

    this.activityLogService.log({
      adminId: userId,
      action: 'DELETE_DISTRICT',
      module: 'SYSTEM',
      targetId: existing.id,
      targetLabel: existing.name,
    });

    return deleted;
  }

  //create coupons mock
  async createMockCoupons() {
    for (const couponData of couponsData) {
      await this.prisma.coupon.create({
        data: couponData,
      });
    }
  }
  // ── Create ──────────────────────────────────────────────────────────────────

  async createCoupon(dto: CreateCouponDto, adminId: number) {
    if (
      (dto.discountType === CouponDiscountType.PERCENTAGE ||
        dto.discountType === CouponDiscountType.FIXED_AMOUNT) &&
      (dto.discountValue === undefined || dto.discountValue === null)
    ) {
      throw new BadRequestException(
        'discountValue is required for PERCENTAGE or FIXED_AMOUNT coupon type',
      );
    }

    const start = dto.startDate ?? new Date();
    if (new Date(dto.expiryDate) <= new Date(start)) {
      throw new BadRequestException('expiryDate must be after startDate');
    }

    try {
      const coupon = await this.prisma.coupon.create({
        data: {
          code: dto.code.toUpperCase().trim(),
          discountType: dto.discountType,
          discountValue: dto.discountValue ?? null,
          minOrderValue: dto.minOrderValue ?? null,
          maxDiscount: dto.maxDiscount ?? null,
          startDate: start,
          expiryDate: dto.expiryDate,
          isActive: dto.isActive ?? true,
        },
      });

      this.activityLogService.log({
        adminId,
        action: 'CREATE_COUPON',
        module: 'MARKETING',
        targetId: coupon.id,
        targetLabel: coupon.code,
        newValue: {
          isActive: coupon.isActive,
          code: coupon.code,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          minOrderValue: coupon.minOrderValue,
          maxDiscount: coupon.maxDiscount,
          expiryDate: coupon.expiryDate,
          startDate: coupon.startDate,
        },
      });

      return coupon;
    } catch (error) {
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

  // ── Get All ─────────────────────────────────────────────────────────────────

  async getAllCoupons(query: GetCouponsQueryDto) {
    const where: Prisma.CouponWhereInput = {};

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.discountType) {
      where.discountType = query.discountType;
    }

    // By default exclude expired coupons unless explicitly requested
    if (!query.includeExpired) {
      where.expiryDate = { gte: new Date() };
    }

    if (query.search) {
      where.code = {
        contains: query.search.toUpperCase(),
        mode: 'insensitive',
      };
    }

    return await this.prisma.coupon.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Get Single ──────────────────────────────────────────────────────────────

  async getCouponById(id: number) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });

    if (!coupon) {
      throw new NotFoundException(`Coupon #${id} not found`);
    }

    return coupon;
  }

  // ── Update ──────────────────────────────────────────────────────────────────

  async updateCoupon(id: number, dto: UpdateCouponDto, adminId: number) {
    const existing = await this.getCouponById(id);

    // Re-validate discountValue if discountType is being changed or value is being updated
    const resolvedType = dto.discountType ?? existing.discountType;
    const resolvedValue =
      dto.discountValue !== undefined
        ? dto.discountValue
        : existing.discountValue;

    if (
      (resolvedType === CouponDiscountType.PERCENTAGE ||
        resolvedType === CouponDiscountType.FIXED_AMOUNT) &&
      (resolvedValue === undefined || resolvedValue === null)
    ) {
      throw new BadRequestException(
        'discountValue is required for PERCENTAGE or FIXED_AMOUNT coupon type',
      );
    }

    // Re-validate dates if either is being updated
    const resolvedStart = dto.startDate
      ? new Date(dto.startDate)
      : existing.startDate;
    const resolvedExpiry = dto.expiryDate
      ? new Date(dto.expiryDate)
      : existing.expiryDate;

    if (resolvedExpiry <= resolvedStart) {
      throw new BadRequestException('expiryDate must be after startDate');
    }

    try {
      const updated = await this.prisma.coupon.update({
        where: { id },
        data: {
          ...(dto.code && { code: dto.code.toUpperCase().trim() }),
          ...(dto.discountType && { discountType: dto.discountType }),
          ...(dto.discountValue !== undefined && {
            discountValue: dto.discountValue,
          }),
          ...(dto.minOrderValue !== undefined && {
            minOrderValue: dto.minOrderValue,
          }),
          ...(dto.maxDiscount !== undefined && {
            maxDiscount: dto.maxDiscount,
          }),
          ...(dto.startDate && { startDate: dto.startDate }),
          ...(dto.expiryDate && { expiryDate: dto.expiryDate }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
      });

      this.activityLogService.log({
        adminId,
        action: 'UPDATE_COUPON',
        module: 'MARKETING',
        targetId: updated.id,
        targetLabel: updated.code,
        oldValue: {
          isActive: existing.isActive,
          code: existing.code,
          discountType: existing.discountType,
          discountValue: existing.discountValue,
          minOrderValue: existing.minOrderValue,
          maxDiscount: existing.maxDiscount,
          expiryDate: existing.expiryDate,
          startDate: existing.startDate,
        },
        newValue: {
          isActive: updated.isActive,
          code: updated.code,
          discountType: updated.discountType,
          discountValue: updated.discountValue,
          minOrderValue: updated.minOrderValue,
          maxDiscount: updated.maxDiscount,
          expiryDate: updated.expiryDate,
          startDate: updated.startDate,
        },
      });

      return updated;
    } catch (error) {
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

  // ── Toggle Status ───────────────────────────────────────────────────────────

  async toggleCouponStatus(id: number, adminId: number) {
    const existing = await this.getCouponById(id);

    const updated = await this.prisma.coupon.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });

    this.activityLogService.log({
      adminId,
      action: 'TOGGLE_COUPON_STATUS',
      module: 'MARKETING',
      targetId: updated.id,
      targetLabel: updated.code,
      oldValue: { isActive: existing.isActive },
      newValue: { isActive: updated.isActive },
    });

    return updated;
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  async deleteCoupon(id: number, adminId: number) {
    const existing = await this.getCouponById(id);

    await this.prisma.coupon.delete({ where: { id } });

    this.activityLogService.log({
      adminId,
      action: 'DELETE_COUPON',
      module: 'MARKETING',
      targetId: id,
      targetLabel: existing.code,
      oldValue: {
        code: existing.code,
        discountType: existing.discountType,
        discountValue: existing.discountValue,
        isActive: existing.isActive,
      },
    });

    return { message: `Coupon "${existing.code}" deleted successfully` };
  }

  // ── Validate (storefront cart use) ─────────────────────────────────────────

  async validateCoupon(code: string, orderValue: number) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: code.toUpperCase().trim() },
    });

    if (!coupon) {
      throw new NotFoundException('Coupon code not found');
    }

    if (!coupon.isActive) {
      throw new BadRequestException('This coupon is no longer active');
    }

    const now = new Date();

    if (now < coupon.startDate) {
      throw new BadRequestException('This coupon is not yet valid');
    }

    if (now > coupon.expiryDate) {
      throw new BadRequestException('This coupon has expired');
    }

    if (coupon.minOrderValue && orderValue < coupon.minOrderValue) {
      throw new BadRequestException(
        `Minimum order value of $${coupon.minOrderValue} required for this coupon`,
      );
    }

    // Calculate discount amount
    let discountAmount = 0;

    if (coupon.discountType === CouponDiscountType.PERCENTAGE) {
      discountAmount = (orderValue * (coupon.discountValue ?? 0)) / 100;
      if (coupon.maxDiscount && discountAmount > coupon.maxDiscount) {
        discountAmount = coupon.maxDiscount;
      }
    } else if (coupon.discountType === CouponDiscountType.FIXED_AMOUNT) {
      discountAmount = coupon.discountValue ?? 0;
      // Cap at order value — can't discount more than the order itself
      if (discountAmount > orderValue) {
        discountAmount = orderValue;
      }
    } else if (coupon.discountType === CouponDiscountType.FREE_DELIVERY) {
      // Return signal — let the cart service handle the actual delivery cost
      discountAmount = 0;
    }

    return {
      valid: true,
      coupon,
      discountAmount,
      finalOrderValue: Math.max(0, orderValue - discountAmount),
    };
  }

  // COLOR ATTRIBUTE
  async createColor(dto: CreateColorDto, adminId: number) {
    // Prevent duplicate colors (hex should be unique logically)
    const existing = await this.prisma.color.findFirst({
      where: {
        hexCode: dto.hexCode,
      },
    });

    if (existing) {
      throw new ConflictException('Color with this hex code already exists');
    }

    const color = await this.prisma.color.create({
      data: {
        name: dto.name,
        hexCode: dto.hexCode,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });

    //activity log
    this.activityLogService.log({
      adminId,
      action: 'CREATE_COLOR',
      module: 'CATALOG',
      targetId: color.id,
      targetLabel: color.name,
      newValue: {
        name: color.name,
        hexCode: color.hexCode,
        sortOrder: color.sortOrder,
        isActive: color.isActive,
      },
    });

    return color;
  }

  // SIZE ATTRIBUTE
  async createSize(dto: CreateSizeDto, adminId: number) {
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

    const size = await this.prisma.size.create({
      data: {
        name: dto.name,
        variantId: dto.variantId, // always defined
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });

    this.activityLogService.log({
      adminId,
      action: 'CREATE_SIZE',
      module: 'CATALOG',
      targetId: size.id,
      targetLabel: size?.name || '',
      metadata: {
        dto,
      },
    });

    return size;
  }

  // VARIANT ATTRIBUTE
  async createVariant(dto: CreateVariantDto, adminId: number) {
    // Check uniqueness by name
    const existing = await this.prisma.variant.findFirst({
      where: { name: dto.name },
    });

    if (existing) {
      throw new ConflictException('Variant with this name already exists');
    }

    const variant = await this.prisma.variant.create({
      data: {
        name: dto.name,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });

    this.activityLogService.log({
      adminId,
      action: 'CREATE_VARIANT',
      module: 'CATALOG',
      targetId: variant.id,
      targetLabel: variant.name,
      newValue: {
        isActive: variant.isActive,
        name: variant.name,
      },
    });

    return variant;
  }

  // create initial city data
  async createInitialDistrict(userId: number) {
    for (const district of districtsData) {
      // Remove trailing spaces from names
      const cleanName = district.name.trim();

      // Check if district already exists
      const existingDistrict = await this.prisma.city.findUnique({
        where: { name: cleanName },
      });

      if (!existingDistrict) {
        await this.prisma.city.create({
          data: {
            name: cleanName,
            deliveryFee: Number(process.env.DEFAULT_DELIVERY_FEE) || 120,
          },
        });
      // console.log(`Created city: ${cleanName}`);
      } else {
      // console.log(`District already exists: ${cleanName}`);
      }
    }
  }

  // create city data
  async createDistrict(userId: number, districtDto: CreateDistrictDto) {
    const cleanName = districtDto.name.trim();

    // Check if city already exists
    const existingDistrict = await this.prisma.city.findUnique({
      where: { name: cleanName },
    });

    if (existingDistrict) {
      throw new BadRequestException('District already exists');
    }

    const city = await this.prisma.city.create({
      data: {
        name: cleanName,
        deliveryFee:
          districtDto.deliveryFee ??
          Number(process.env.DEFAULT_DELIVERY_FEE) ??
          120,
        isCODAvailable: districtDto.isCODAvailable ?? true,
      },
    });

    this.activityLogService.log({
      adminId: userId,
      action: 'CREATE_DISTRICT',
      module: 'SYSTEM',
      targetId: city.id,
      targetLabel: city.name,
      newValue: {
        isActive: city.isActive,
        name: city.name,
      },
    });

    return city;
  }

  // MATERIAL ATTRIBUTE
  async addMaterial(dto: CreateMaterialDto, adminId: number) {
    // Check uniqueness by name
    const existing = await this.prisma.material.findFirst({
      where: { name: dto.name },
    });

    if (existing) {
      throw new ConflictException('Material with this name already exists');
    }

    const material = await this.prisma.material.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        order: dto.order ?? 0,
        isActive: dto.isActive ?? true,
      },
    });

    this.activityLogService.log({
      adminId,
      action: 'CREATE_MATERIAL',
      module: 'CATALOG',
      targetId: material.id,
      targetLabel: material.name,
      newValue: {
        isActive: material.isActive,
        name: material.name,
        slug: material.slug,
        order: material.order,
      },
    });

    return material;
  }

  getAllVariants() {
    return this.prisma.variant.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  getAllSizes() {
    return this.prisma.size.findMany({ orderBy: { sortOrder: 'asc' } });
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

  async getDistricts() {
    return await this.prisma.city.findMany({
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
}
