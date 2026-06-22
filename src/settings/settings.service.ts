/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AppSettingsService } from './app-settings.service';
import { PaymentMethodConfigService } from 'src/payment-method-config/payment-method-config.service';

@Injectable()
export class SettingsService {
  constructor(
    private prisma: PrismaService,
    private appSettingsService: AppSettingsService,
    private paymentMethodConfigService: PaymentMethodConfigService,
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

  async updateShipping(payload: { defaultCharge?: number }) {
    if (payload.defaultCharge !== undefined) {
      await this.appSettingsService.updateDefaultDeliveryFee(
        payload.defaultCharge,
      );
    }
    return this.getShipping();
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
