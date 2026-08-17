/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AppSettingsService } from './app-settings.service';
import { PaymentMethodConfigService } from 'src/payment-method-config/payment-method-config.service';
import { ActivityLogService } from 'src/activity-log/activity-log.service';

@Injectable()
export class SettingsService {
  constructor(
    private prisma: PrismaService,
    private appSettingsService: AppSettingsService,
    private paymentMethodConfigService: PaymentMethodConfigService,
    private activityLogService: ActivityLogService,
  ) {}

  // general/email/sms settings have no real backing feature yet (no admin
  // UI consumes them) — kept as an in-memory placeholder, out of scope for
  // the Delivery/COD/Payment settings work.
  private settings = {
    general: { siteName: 'My Store', currency: 'BDT' },
    email: { smtpHost: '', smtpPort: 587, username: '', password: '' },
    sms: { provider: '', apiKey: '' },
  };

  async getAll() {
    return {
      ...this.settings,
      payment: await this.getPayment(),
      shipping: await this.getShipping(),
    };
  }

  // Only merges into the still-mock general/email/sms slices. `payment` and
  // `shipping` are real, validated, permission-gated settings now — they
  // must go through their own dedicated routes, not a blind merge here.
  async updateAll(payload: {
    general?: Record<string, any>;
    email?: Record<string, any>;
    sms?: Record<string, any>;
  }) {
    if (payload?.general) {
      this.settings.general = { ...this.settings.general, ...payload.general };
    }
    if (payload?.email) {
      this.settings.email = { ...this.settings.email, ...payload.email };
    }
    if (payload?.sms) {
      this.settings.sms = { ...this.settings.sms, ...payload.sms };
    }
    return this.getAll();
  }

  // Payment settings — real data, single source of truth is
  // PaymentMethodConfig (see /payment-methods for the full CRUD admin API).
  getPayment() {
    return this.paymentMethodConfigService.findAllAdmin();
  }

  // Shipping settings — `defaultCharge` is the persisted global fallback
  // delivery fee (used when a new district is created without one).
  // `codEligibleDistricts` is derived live from City.isCODAvailable, not
  // stored here, so there's only one source of truth for COD eligibility.
  async getShipping() {
    const [appSettings, codDistricts] = await Promise.all([
      this.appSettingsService.get(),
      this.prisma.city.findMany({
        where: { isCODAvailable: true },
        select: { name: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    return {
      defaultCharge: appSettings.defaultDeliveryFee,
      codEligibleDistricts: codDistricts.map((d) => d.name),
    };
  }

  async updateShipping(payload: { defaultCharge?: number }, adminId: number) {
    if (payload.defaultCharge !== undefined) {
      const before = await this.getShipping();
      await this.appSettingsService.updateDefaultDeliveryFee(
        payload.defaultCharge,
      );

      await this.activityLogService.log({
        adminId,
        action: 'UPDATE_SHIPPING_SETTINGS',
        module: 'SYSTEM',
        targetLabel: 'Shipping settings',
        oldValue: { defaultCharge: before.defaultCharge },
        newValue: { defaultCharge: payload.defaultCharge },
      });
    }
    return this.getShipping();
  }

  // Printing settings — courier delivery label size. Product barcode label
  // presets live in their own CRUD (see LabelSizeService / GET /label-sizes).
  getPrinting() {
    return this.appSettingsService.getPrinting();
  }

  async updatePrinting(
    payload: {
      courierLabelWidthMm?: number;
      courierLabelHeightMm?: number;
    },
    adminId: number,
  ) {
    const before = await this.getPrinting();
    const updated = await this.appSettingsService.updatePrinting(payload);

    await this.activityLogService.log({
      adminId,
      action: 'UPDATE_PRINTING_SETTINGS',
      module: 'SYSTEM',
      targetLabel: 'Printing settings',
      oldValue: before,
      newValue: updated,
    });

    return updated;
  }

  // Invoice settings — print/PDF paper size.
  getInvoiceSettings() {
    return this.appSettingsService.getInvoiceSettings();
  }

  async updateInvoiceSettings(
    payload: {
      invoicePaperSize?: string;
      invoicePaperWidthMm?: number | null;
      invoicePaperHeightMm?: number | null;
    },
    adminId: number,
  ) {
    const before = await this.getInvoiceSettings();
    const updated = await this.appSettingsService.updateInvoiceSettings(
      payload,
    );

    await this.activityLogService.log({
      adminId,
      action: 'UPDATE_INVOICE_SETTINGS',
      module: 'SYSTEM',
      targetLabel: 'Invoice settings',
      oldValue: before,
      newValue: updated,
    });

    return updated;
  }

  // Email settings
  getEmail() { return this.settings.email; }
  updateEmail(payload: any) {
    this.settings.email = { ...this.settings.email, ...payload };
    return this.settings.email;
  }

  // SMS settings
  getSms() { return this.settings.sms; }
  updateSms(payload: any) {
    this.settings.sms = { ...this.settings.sms, ...payload };
    return this.settings.sms;
  }
}
