/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// notification.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { MailerService } from '@nestjs-modules/mailer';
// import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { otpEmailTemplate } from './templates/otp.template';
import axios from 'axios';

@Injectable()
export class NotificationsService {
  private logger = new Logger('NotificationService');

  constructor(
    private mailerService: MailerService,
    // private config: ConfigService,
    @InjectQueue('notification') private notificationQueue: Queue,
  ) {}

  async sendOrderConfirmation(
    user: { email: string; phone: string },
    order: {
      orderId: string;
      customerName: string;
      trackingToken: string;
      shippingAddress: string;
      districtName?: string | null;
      postCode: string | null;
      items: {
        productTitle: string | null;
        size: string | null;
        color: string | null;
        quantity: number;
        priceAtPurchase: number;
      }[];
      subtotal: number;
      deliveryCharge: number | null;
      total: number;
    },
  ) {
    // Send email
    await this.notificationQueue.add('sendEmail', {
      email: user.email,
      subject: `Order #${order.orderId} Confirmed`,
      template: 'order-confirmation',
      context: {
        customerName: order.customerName,
        orderId: order.orderId,
        trackingToken: order.trackingToken,
        shippingAddress: order.shippingAddress,
        districtName: order.districtName,
        postCode: order.postCode,
        items: order.items,
        subtotal: order.subtotal,
        deliveryCharge: order.deliveryCharge,
        total: order.total,
      },
    });

    // Send SMS (can be simpler)
    await this.notificationQueue.add('sendSMS', {
      phone: user.phone,
      message: `Hi ${order.customerName}, your order #${order.orderId} has been confirmed. Total: ৳${order.total}.`,
    });
  }

  async sendStatusUpdate(
    user: { email: string; phone: string },
    order: {
      orderId: string;
      customerName: string;
      status: string;
      trackingToken?: string;
    },
  ) {
    await this.notificationQueue.add('sendEmail', {
      email: user.email,
      subject: `Order #${order.orderId} is now ${order.status}`,
      template: 'order-status-update',
      context: {
        customerName: order.customerName,
        orderId: order.orderId,
        status: order.status,
        trackingToken: order.trackingToken,
      },
    });

    await this.notificationQueue.add('sendSMS', {
      phone: user.phone,
      message: `Hi ${order.customerName}, your order #${order.orderId} is now ${order.status}.`,
    });
  }

  async processEmailJob(job: any) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const html =
      job.data.template === 'otp'
        ? otpEmailTemplate(job.data.context.otp, job.data.context.purpose)
        : job.data.html; // fallback for other email types later

    // console.log(job.data, 'jobss2');
    try {
      await resend.emails.send({
        from: 'Ondorkotha <' + process.env.RESEND_FROM_EMAIL + '>',
        to: job.data.email,
        subject: job.data.subject,
        html,
      });
      this.logger.log(`Email sent to ${job.data.email}`);
    } catch (err) {
      this.logger.error(`Failed to send email to ${job.data.email}`, err);
      throw err;
    }
  }

  async processSMSJob(job: any) {
    try {
      // Normalize: strip +, spaces, dashes → ensure starts with 880
      let phone: string = job.data.phone.replace(/[\s\-]/g, '');

      if (phone.startsWith('+880')) {
        phone = phone.slice(1); // +8801XXXXXXXX → 8801XXXXXXXX
      } else if (phone.startsWith('01')) {
        phone = `88${phone}`; // 01XXXXXXXX → 8801XXXXXXXX
      } else if (phone.startsWith('+88')) {
        phone = phone.slice(1); // +8801... → 8801...
      }

      if (process.env.NODE_ENV === 'development') {
        this.logger.log(`[DEV] SMS OTP for ${phone}: ${job.data.message}`);
        return;
      }

      // already starts with 880
      const smsReturn = await axios.post(
        'https://api.mimsms.com/api/SmsSending/SMS',
        {
          ApiKey: process.env.MIMSMS_API_KEY,
          MobileNumber: phone,
          SenderName: process.env.MIMSMS_SENDER_NAME,
          UserName: process.env.MIMSMS_USERNAME,
          TransactionType: 'T',
          Message: job.data.message,
          CampaignId: 'null',
        },
      );

      // console.log(smsReturn, 'smsReturn');

      this.logger.log(`SMS sent to ${phone}`);
    } catch (err) {
      this.logger.error(`Failed to send SMS to ${job.data.phone}`, err);
      throw err;
    }
  }
}
