/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// src/barcode/barcode.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Response } from 'express';
import * as bwipjs from 'bwip-js';
import puppeteer from 'puppeteer';
import {
  AssignLocationDto,
  CreateBarcodeDto,
  CreateLocationDto,
} from './dto/barcode.dto';

@Injectable()
export class BarcodeService {
  constructor(private prisma: PrismaService) {}

  // ── Generate sequential barcode value ─────────────────────────────────────
  private async nextBarcodeValue(): Promise<string> {
    const count = await this.prisma.inventoryItem.count();
    return `SKG-${String(count + 1).padStart(7, '0')}`;
  }

  // ── Create barcode for a product ──────────────────────────────────────────
  async createBarcode(dto: CreateBarcodeDto) {
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

    return this.prisma.inventoryItem.create({
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
    return this.prisma.inventoryItem.findMany({
      where: lowStockOnly
        ? { quantity: { lte: this.prisma.inventoryItem.fields.lowStockAt } }
        : undefined,
      include: { product: true, location: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Assign / update warehouse location ────────────────────────────────────
  async assignLocation(barcodeId: string, dto: AssignLocationDto) {
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
    const barcodes = await this.prisma.inventoryItem.findMany({
      where: { id: { in: barcodeIds } },
      include: { product: true, location: true },
    });

    if (!barcodes.length) throw new NotFoundException('No barcodes found');

    // Generate base64 barcode PNGs for each
    const withImages = await Promise.all(
      barcodes.map(async (bc) => {
        const png =
          bc.barcodeType === 'QR'
            ? await this.generateQrPng(bc.barcode)
            : await this.generateBarcodePng(bc.barcode);
        return { ...bc, imgBase64: png.toString('base64') };
      }),
    );

    // Record print
    await this.prisma.inventoryItem.updateMany({
      where: { id: { in: barcodeIds } },
      data: { printedAt: new Date(), printCount: { increment: 1 } },
    });

    const html = this.buildLabelSheetHtml(withImages);
    const buffer = await this.renderPdf(html);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=sakigai-labels.pdf',
    );
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  }

  // ── Puppeteer render ───────────────────────────────────────────────────────
  private async renderPdf(html: string): Promise<Buffer> {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '12mm', right: '10mm', bottom: '12mm', left: '10mm' },
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  // ── Label sheet HTML (4×6 grid, Avery-style) ──────────────────────────────
  private buildLabelSheetHtml(barcodes: any[]): string {
    const labels = barcodes
      .map(
        (bc) => `
      <div class="label">
        <div class="label-brand">SAKIGAI</div>
        <div class="label-name">${this.truncate(bc.product?.name ?? '—', 28)}</div>
        <img class="barcode-img" src="data:image/png;base64,${bc.imgBase64}" alt="${bc.barcode}" />
        <div class="label-code">${bc.barcode}</div>
        <div class="label-footer">
          <span class="loc-badge">${bc.location?.code ?? 'NO LOC'}</span>
          <span class="stock">QTY: ${bc.quantity}</span>
          ${bc.quantity <= bc.lowStockAt ? '<span class="low-stock">LOW</span>' : ''}
        </div>
        ${bc.location ? `<div class="label-loc-detail">${bc.location.label ?? bc.location.code}</div>` : ''}
      </div>`,
      )
      .join('');

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .label {
    border: 1.5px solid #1e293b;
    border-radius: 6px;
    padding: 10px 10px 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    page-break-inside: avoid;
    background: #fff;
    min-height: 120px;
  }
  .label-brand {
    font-size: 7px;
    font-weight: 800;
    letter-spacing: 0.3em;
    color: #94a3b8;
    text-transform: uppercase;
    align-self: flex-start;
  }
  .label-name {
    font-size: 10px;
    font-weight: 700;
    color: #0f172a;
    text-align: center;
    line-height: 1.3;
  }
  .barcode-img {
    max-width: 100%;
    height: 38px;
    object-fit: contain;
    margin: 2px 0;
  }
  .label-code {
    font-family: 'Courier New', monospace;
    font-size: 8px;
    color: #475569;
    letter-spacing: 0.05em;
  }
  .label-footer {
    display: flex;
    align-items: center;
    gap: 5px;
    width: 100%;
    justify-content: center;
  }
  .loc-badge {
    background: #0f172a;
    color: #e2c97e;
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.08em;
    padding: 2px 6px;
    border-radius: 3px;
    font-family: 'Courier New', monospace;
  }
  .stock {
    font-size: 8px;
    color: #64748b;
    font-family: 'Courier New', monospace;
  }
  .low-stock {
    background: #fef2f2;
    color: #dc2626;
    font-size: 7px;
    font-weight: 800;
    padding: 1px 5px;
    border-radius: 3px;
    border: 1px solid #fca5a5;
    letter-spacing: 0.05em;
  }
  .label-loc-detail {
    font-size: 7.5px;
    color: #94a3b8;
    text-align: center;
    font-style: italic;
  }
</style>
</head>
<body>
  <div class="grid">${labels}</div>
</body>
</html>`;
  }

  private truncate(str: string, n: number) {
    return str.length > n ? str.slice(0, n - 1) + '…' : str;
  }
}
