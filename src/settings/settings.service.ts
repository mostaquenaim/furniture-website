/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';

@Injectable()
export class SettingsService {
  private settings = {
    general: { siteName: 'My Store', currency: 'BDT' },
    payment: { sslcommerz: true, bkash: true, cod: true, emi: true },
    shipping: { defaultCharge: 50, codEligibleDistricts: ['Dhaka', 'Chittagong'] },
    email: { smtpHost: '', smtpPort: 587, username: '', password: '' },
    sms: { provider: '', apiKey: '' },
  };

  getAll() {
    return this.settings;
  }

  updateAll(payload: any) {
    this.settings = { ...this.settings, ...payload };
    return this.settings;
  }

  // Payment settings
  getPayment() { return this.settings.payment; }
  updatePayment(payload: any) {
    this.settings.payment = { ...this.settings.payment, ...payload };
    return this.settings.payment;
  }

  // Shipping settings
  getShipping() { return this.settings.shipping; }
  updateShipping(payload: any) {
    this.settings.shipping = { ...this.settings.shipping, ...payload };
    return this.settings.shipping;
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
