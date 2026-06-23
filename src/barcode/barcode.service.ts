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
import puppeteer, { Browser } from 'puppeteer';
import {
  AssignLocationDto,
  CreateBarcodeDto,
  CreateLocationDto,
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
      include: { product: true, location: true },
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

  // ── Print label sheet PDF (multiple labels per page) ──────────────────────
  async printLabelSheet(barcodeIds: string[], res: Response) {
    if (!barcodeIds?.length) {
      throw new NotFoundException('No barcode IDs provided');
    }

    const barcodes = await this.prisma.inventoryItem.findMany({
      where: { id: { in: barcodeIds } },
      include: { product: true, location: true },
    });

    if (!barcodes.length) {
      throw new NotFoundException('No barcodes found');
    }

    const withImages = await Promise.all(
      barcodes.map(async (bc) => {
        const png =
          bc.barcodeType === 'QR'
            ? await this.generateQrPng(bc.barcode)
            : await this.generateBarcodePng(bc.barcode);

        return {
          ...bc,
          imgBase64: png.toString('base64'),
        };
      }),
    );

    await this.prisma.inventoryItem.updateMany({
      where: { id: { in: barcodeIds } },
      data: {
        printedAt: new Date(),
        printCount: { increment: 1 },
      },
    });

    // One label page per physical piece
    const expandedLabels = withImages.flatMap((bc) =>
      Array.from({ length: Math.max(bc.quantity, 1) }, () => bc),
    );

    const html = this.buildLabelSheetHtml(expandedLabels);
    const pdf = await this.renderPdf(html);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=ondorkotha-labels.pdf',
    );

    res.end(pdf);
  }

  // ── Puppeteer render ───────────────────────────────────────────────────────
  private browser: Browser | null = null;

  private async renderPdf(html: string): Promise<Buffer> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }

    const page = await this.browser.newPage();

    await page.setContent(html, {
      waitUntil: 'domcontentloaded',
    });

    const pdf = await page.pdf({
      width: '100mm',
      height: '50mm',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    await page.close();

    return Buffer.from(pdf);
  }

  // ── Thermal label HTML (100mm × 50mm, one label per page) ───────────────
  private buildLabelSheetHtml(barcodes: any[]): string {
    const labels = barcodes
      .map(
        (bc) => `
      <div class="label">
        <div class="top-row">
          <span class="brand">SAKIGAI</span>
          ${bc.quantity <= bc.lowStockAt ? '<span class="low">LOW</span>' : ''}
        </div>
        <div class="product-name">${this.truncate(bc.product?.title ?? '—', 40)}</div>
        <img class="barcode-img" src="data:image/png;base64,${bc.imgBase64}" alt="${bc.barcode}" />
        <div class="bottom-row">
          <code class="barcode-val">${bc.barcode}</code>
          ${bc.location ? `<span class="loc">${bc.location.code}</span>` : ''}
        </div>
      </div>`,
      )
      .join('');

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<style>
  @page { size: 100mm 50mm; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 100mm;
    font-family: Arial, Helvetica, sans-serif;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .label {
    width: 100mm;
    height: 50mm;
    padding: 3mm;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    page-break-after: always;
  }
  .label:last-child { page-break-after: avoid; }
  .top-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .brand {
    font-size: 7pt;
    font-weight: 800;
    letter-spacing: 0.25em;
    color: #999;
    text-transform: uppercase;
  }
  .low {
    font-size: 6pt;
    font-weight: 800;
    color: #dc2626;
    border: 0.3mm solid #dc2626;
    padding: 0.5mm 1.5mm;
    border-radius: 1mm;
  }
  .product-name {
    font-size: 9pt;
    font-weight: 700;
    color: #000;
    text-align: center;
    line-height: 1.2;
  }
  .barcode-img {
    width: 90mm;
    height: 17mm;
    object-fit: contain;
    display: block;
    margin: 0 auto;
  }
  .bottom-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .barcode-val {
    font-family: 'Courier New', monospace;
    font-size: 7pt;
    color: #444;
  }
  .loc {
    font-size: 7pt;
    font-weight: 700;
    font-family: 'Courier New', monospace;
    background: #000;
    color: #e2c97e;
    padding: 0.5mm 2mm;
    border-radius: 1mm;
  }
</style>
</head>
<body>${labels}</body>
</html>`;
  }

  private truncate(str: string, n: number) {
    return str.length > n ? str.slice(0, n - 1) + '…' : str;
  }
}
