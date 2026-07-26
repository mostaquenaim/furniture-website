import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

const SINGLETON_ID = 1;

// Persisted, admin-editable global defaults — currently just the fallback
// delivery fee used when a new district is created without one.
@Injectable()
export class AppSettingsService {
  constructor(private prisma: PrismaService) {}

  get() {
    return this.prisma.appSettings.upsert({
      where: { id: SINGLETON_ID },
      update: {},
      create: { id: SINGLETON_ID },
    });
  }

  async getDefaultDeliveryFee(): Promise<number> {
    const settings = await this.get();
    return settings.defaultDeliveryFee;
  }

  async updateDefaultDeliveryFee(fee: number) {
    if (typeof fee !== 'number' || Number.isNaN(fee) || fee < 0) {
      throw new BadRequestException(
        'defaultDeliveryFee must be a non-negative number',
      );
    }

    return this.prisma.appSettings.upsert({
      where: { id: SINGLETON_ID },
      update: { defaultDeliveryFee: fee },
      create: { id: SINGLETON_ID, defaultDeliveryFee: fee },
    });
  }

  // Courier delivery label size — single configurable size used for every
  // shipment label print.
  async getPrinting() {
    const settings = await this.get();
    return {
      courierLabelWidthMm: settings.courierLabelWidthMm,
      courierLabelHeightMm: settings.courierLabelHeightMm,
    };
  }

  async updatePrinting(payload: {
    courierLabelWidthMm?: number;
    courierLabelHeightMm?: number;
  }) {
    const { courierLabelWidthMm, courierLabelHeightMm } = payload;

    if (
      courierLabelWidthMm !== undefined &&
      (typeof courierLabelWidthMm !== 'number' ||
        Number.isNaN(courierLabelWidthMm) ||
        courierLabelWidthMm <= 0)
    ) {
      throw new BadRequestException(
        'courierLabelWidthMm must be a positive number',
      );
    }
    if (
      courierLabelHeightMm !== undefined &&
      (typeof courierLabelHeightMm !== 'number' ||
        Number.isNaN(courierLabelHeightMm) ||
        courierLabelHeightMm <= 0)
    ) {
      throw new BadRequestException(
        'courierLabelHeightMm must be a positive number',
      );
    }

    await this.prisma.appSettings.upsert({
      where: { id: SINGLETON_ID },
      update: { courierLabelWidthMm, courierLabelHeightMm },
      create: {
        id: SINGLETON_ID,
        ...(courierLabelWidthMm !== undefined ? { courierLabelWidthMm } : {}),
        ...(courierLabelHeightMm !== undefined
          ? { courierLabelHeightMm }
          : {}),
      },
    });
    return this.getPrinting();
  }

  // Invoice print/PDF paper size.
  async getInvoiceSettings() {
    const settings = await this.get();
    return {
      invoicePaperSize: settings.invoicePaperSize,
      invoicePaperWidthMm: settings.invoicePaperWidthMm,
      invoicePaperHeightMm: settings.invoicePaperHeightMm,
    };
  }

  async updateInvoiceSettings(payload: {
    invoicePaperSize?: string;
    invoicePaperWidthMm?: number | null;
    invoicePaperHeightMm?: number | null;
  }) {
    const { invoicePaperSize, invoicePaperWidthMm, invoicePaperHeightMm } =
      payload;

    if (
      invoicePaperSize !== undefined &&
      !['A4', 'LETTER', 'CUSTOM'].includes(invoicePaperSize)
    ) {
      throw new BadRequestException(
        'invoicePaperSize must be one of A4, LETTER, CUSTOM',
      );
    }

    const resolvedSize =
      invoicePaperSize ?? (await this.getInvoiceSettings()).invoicePaperSize;

    if (resolvedSize === 'CUSTOM') {
      const width = invoicePaperWidthMm ?? undefined;
      const height = invoicePaperHeightMm ?? undefined;
      const existing = await this.getInvoiceSettings();
      const finalWidth = width ?? existing.invoicePaperWidthMm;
      const finalHeight = height ?? existing.invoicePaperHeightMm;
      if (!finalWidth || !finalHeight || finalWidth <= 0 || finalHeight <= 0) {
        throw new BadRequestException(
          'invoicePaperWidthMm and invoicePaperHeightMm are required positive numbers when invoicePaperSize is CUSTOM',
        );
      }
    }

    await this.prisma.appSettings.upsert({
      where: { id: SINGLETON_ID },
      update: {
        invoicePaperSize,
        invoicePaperWidthMm,
        invoicePaperHeightMm,
      },
      create: {
        id: SINGLETON_ID,
        ...(invoicePaperSize !== undefined ? { invoicePaperSize } : {}),
        ...(invoicePaperWidthMm !== undefined ? { invoicePaperWidthMm } : {}),
        ...(invoicePaperHeightMm !== undefined
          ? { invoicePaperHeightMm }
          : {}),
      },
    });
    return this.getInvoiceSettings();
  }
}
