/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// src/barcode/barcode.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Response } from 'express';
import * as bwipjs from 'bwip-js';
import {
  AssignLocationDto,
  CreateBarcodeDto,
  CreateLocationDto,
  PrintLabelItemDto,
} from './dto/barcode.dto';
import { ActivityLogService } from 'src/activity-log/activity-log.service';
import { sanitizeDiscount } from 'src/common/utils/discount.utils';

@Injectable()
export class BarcodeService {
  constructor(
    private prisma: PrismaService,
    private activityLogService: ActivityLogService,
  ) {}

  // ── Generate sequential barcode value ─────────────────────────────────────
  private async nextBarcodeValue(): Promise<string> {
    const count = await this.prisma.inventoryItem.count();
    return `SKG-${String(count + 1).padStart(7, '0')}`;
  }

  // ── Create barcode for a product ──────────────────────────────────────────
  async createBarcode(dto: CreateBarcodeDto, adminId: number) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });
    if (!product) throw new NotFoundException('Product not found');

    // const existing = await this.prisma.inventoryItem.findFirst({
    //   where: { productId: dto.productId },
    // });
    // if (existing)
    //   throw new ConflictException('Barcode already exists for this product');

    if (dto.locationId) {
      const existingLocation = await this.prisma.warehouseLocation.findUnique({
        where: { id: dto.locationId },
      });
      if (!existingLocation)
        throw new NotFoundException('Assigned location not found');
    }

    const barcode = dto.barcode ?? (await this.nextBarcodeValue());

    const item = await this.prisma.inventoryItem.create({
      data: {
        productId: dto.productId,
        barcode,
        barcodeType: dto.barcodeType ?? 'CODE128',
        locationId: dto.locationId,
        quantity: dto.quantity ?? 0,
        lowStockAt: dto.lowStockAt ?? 5,
      },
      include: { product: true, location: true },
    });

    await this.activityLogService.log({
      adminId,
      action: 'CREATE_BARCODE',
      module: 'INVENTORY',
      targetId: item.id,
      targetLabel: `${product.title} (${barcode})`,
      newValue: {
        productId: item.productId,
        productSizeId: item.productSizeId,
        barcode: item.barcode,
        quantity: item.quantity,
        locationId: item.locationId,
      },
    });

    return item;
  }

  // ── Get barcode by product ID ──────────────────────────────────────────────
  async getByProductId(productId: number) {
    const bc = await this.prisma.inventoryItem.findMany({
      where: { productId },
      include: {
        product: true,
        location: true,
        productSize: {
          include: {
            size: true,
            color: { include: { color: true } },
          },
        },
      },
    });
    if (!bc) throw new NotFoundException('No barcode for this product');
    return bc;
  }

  // ── Get all barcodes (with optional low-stock filter) ─────────────────────
  async getAll(lowStockOnly = false) {
    const items = await this.prisma.inventoryItem.findMany({
      where: lowStockOnly
        ? { quantity: { lte: this.prisma.inventoryItem.fields.lowStockAt } }
        : undefined,
      include: {
        product: {
          select: {
            title: true,
            basePrice: true,
            price: true,
            discount: true,
            discountType: true,
            discountStart: true,
            discountEnd: true,
          },
        },
        location: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return items.map((item) => ({
      ...item,
      product: sanitizeDiscount(item.product),
    }));
  }

  // ── Assign / update warehouse location ────────────────────────────────────
  async assignLocation(barcodeId: string, dto: AssignLocationDto) {
    console.log('Assigning location', dto.locationId, 'to barcode', barcodeId);
    return this.prisma.$transaction(async (tx) => {
      // 1. Verify existence and current state
      const item = await tx.inventoryItem.findUnique({
        where: { id: barcodeId },
        select: { id: true, quantity: true, locationId: true },
      });

      if (!item) {
        throw new NotFoundException(
          `Inventory item with barcode ${barcodeId} not found`,
        );
      }

      if (dto.locationId === null) {
        console.log('Unassigning location for barcode', barcodeId);
        // Unassign location
        const updatedItem = await tx.inventoryItem.update({
          where: { id: barcodeId },
          data: { locationId: null, quantity: dto.quantity ?? item.quantity },
          include: { product: true, location: true },
        });
        return updatedItem;
      }

      // 2. Validate the new location
      const location = await tx.warehouseLocation.findUnique({
        where: { id: dto.locationId },
      });

      if (!location) {
        throw new NotFoundException(
          `Target location ${dto.locationId} does not exist`,
        );
      }

      // 3. Perform the update
      const updatedItem = await tx.inventoryItem.update({
        where: { id: barcodeId },
        data: { locationId: dto.locationId, quantity: dto.quantity },
        include: { product: true, location: true },
      });

      return updatedItem;
    });
  }

  // ── Update stock quantity ──────────────────────────────────────────────────
  async updateQuantity(barcodeId: string, delta: number) {
    const bc = await this.prisma.inventoryItem.findUnique({
      where: { id: barcodeId },
    });
    if (!bc) throw new NotFoundException('Barcode not found');

    return this.prisma.inventoryItem.update({
      where: { id: barcodeId },
      data: { quantity: { increment: delta } },
      include: { product: true, location: true },
    });
  }

  // ── Get low-stock items ────────────────────────────────────────────────────
  async getLowStock() {
    const all = await this.prisma.inventoryItem.findMany({
      include: { product: true, location: true },
    });
    return all.filter((b) => b.quantity <= b.lowStockAt);
  }

  // ── CRUD for inventory locations ───────────────────────────────────────────
  async createLocation(dto: CreateLocationDto) {
    const code = `${dto.zone}-${dto.aisle}-${dto.shelf}-${dto.bin}`;
    return await this.prisma.warehouseLocation.create({
      data: { ...dto, code },
    });
  }

  async getLocations() {
    return await this.prisma.warehouseLocation.findMany({
      include: { items: { include: { product: true } } },
      orderBy: { code: 'asc' },
    });
  }

  // ── Generate raw PNG barcode image ────────────────────────────────────────
  async generateBarcodePng(value: string): Promise<Buffer> {
    return bwipjs.toBuffer({
      bcid: 'code128',
      text: value,
      scale: 3,
      height: 12,
      includetext: true,
      textxalign: 'center',
      textsize: 9,
    });
  }

  // ── Generate QR code PNG ───────────────────────────────────────────────────
  async generateQrPng(value: string): Promise<Buffer> {
    return bwipjs.toBuffer({
      bcid: 'qrcode',
      text: value,
      scale: 4,
    });
  }

  // ── Stream barcode image ───────────────────────────────────────────────────
  async streamBarcodeImage(barcodeId: string, res: Response) {
    const bc = await this.prisma.inventoryItem.findUnique({
      where: { id: barcodeId },
    });

    if (!bc) throw new NotFoundException('Barcode not found');

    const png =
      bc.barcodeType === 'QR'
        ? await this.generateQrPng(bc.barcode)
        : await this.generateBarcodePng(bc.barcode);

    res.setHeader('Content-Type', 'image/png');
    res.end(png);
  }

  // ── Confirm label print: persist lot/packing info, bump print counters ────
  async confirmPrint(items: PrintLabelItemDto[]) {
    if (!items?.length) {
      throw new NotFoundException('No label items provided');
    }

    const barcodeIds = items.map((i) => i.barcodeId);
    const existing = await this.prisma.inventoryItem.findMany({
      where: { id: { in: barcodeIds } },
      select: { id: true },
    });
    if (!existing.length) {
      throw new NotFoundException('No barcodes found');
    }

    await Promise.all(
      items.map((item) =>
        this.prisma.inventoryItem.update({
          where: { id: item.barcodeId },
          data: {
            ...(item.lotNumber !== undefined && {
              lotNumber: item.lotNumber,
            }),
            ...(item.packingDate !== undefined && {
              packingDate: new Date(item.packingDate),
            }),
            printedAt: new Date(),
            printCount: { increment: 1 },
          },
        }),
      ),
    );

    return this.prisma.inventoryItem.findMany({
      where: { id: { in: barcodeIds } },
      include: { product: true, location: true },
    });
  }
}
