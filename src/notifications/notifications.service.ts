/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// notification.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { otpEmailTemplate } from './templates/otp.template';
import axios from 'axios';

export interface LowStockAlertItem {
  productTitle: string;
  sku: string | null;
  size: string;
  color: string;
  quantity: number;
  lowStockAt: number;
}

@Injectable()
export class NotificationsService {
  private logger = new Logger('NotificationService');

  constructor(
    private mailerService: MailerService,
    private config: ConfigService,
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

  /**
   * Queues the customer-facing email/SMS for an order status change. Both
   * channels are optional and independent — a guest with only a phone number
   * still gets the SMS, a customer with only an email still gets the email.
   * Never throws: a malformed contact field shouldn't fail the status update
   * itself, only skip that one channel (logged by the caller's catch, if any).
   */
  async sendStatusUpdate(
    contact: { email?: string | null; phone?: string | null },
    order: {
      orderId: string;
      customerName: string;
      status: string;
      trackingToken?: string;
    },
  ) {
    const statusLabel = order.status
      .toLowerCase()
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    const jobs: Promise<unknown>[] = [];

    if (contact.email) {
      jobs.push(
        this.notificationQueue.add('sendEmail', {
          email: contact.email,
          subject: `Order #${order.orderId} is now ${statusLabel}`,
          template: 'order-status-update',
          context: {
            customerName: order.customerName,
            orderId: order.orderId,
            status: statusLabel,
            trackingToken: order.trackingToken,
          },
        }),
      );
    } else {
      this.logger.warn(
        `Skipping status-update email for order ${order.orderId} — no email on file`,
      );
    }

    if (contact.phone) {
      jobs.push(
        this.notificationQueue.add('sendSMS', {
          phone: contact.phone,
          message: `Hi ${order.customerName}, your order #${order.orderId} is now ${statusLabel}.`,
        }),
      );
    } else {
      this.logger.warn(
        `Skipping status-update SMS for order ${order.orderId} — no phone on file`,
      );
    }

    await Promise.all(jobs);
  }

  /**
   * Queues the customer-facing email/SMS for a return-request lifecycle
   * event (filed, approved, rejected, item received). Same never-throws
   * contract as sendStatusUpdate.
   */
  async sendReturnRequestUpdate(
    contact: { email?: string | null; phone?: string | null },
    data: {
      orderId: string;
      customerName: string;
      event: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'ITEM_RECEIVED';
    },
  ) {
    const copy: Record<typeof data.event, { subject: string; line: string }> = {
      SUBMITTED: {
        subject: `Return request received for order #${data.orderId}`,
        line: `we've received your return request for order #${data.orderId}. We'll review it shortly.`,
      },
      APPROVED: {
        subject: `Return request approved for order #${data.orderId}`,
        line: `your return request for order #${data.orderId} has been approved. Please send the item(s) back to us.`,
      },
      REJECTED: {
        subject: `Return request update for order #${data.orderId}`,
        line: `your return request for order #${data.orderId} could not be approved. Please contact support for details.`,
      },
      ITEM_RECEIVED: {
        subject: `We've received your returned item(s) for order #${data.orderId}`,
        line: `we've received your returned item(s) for order #${data.orderId}. Your refund will be processed shortly.`,
      },
    };

    const { subject, line } = copy[data.event];
    const jobs: Promise<unknown>[] = [];

    if (contact.email) {
      jobs.push(
        this.notificationQueue.add('sendEmail', {
          email: contact.email,
          subject,
          template: 'return-request-update',
          context: {
            customerName: data.customerName,
            orderId: data.orderId,
            message: line,
          },
        }),
      );
    } else {
      this.logger.warn(
        `Skipping return-request email for order ${data.orderId} — no email on file`,
      );
    }

    if (contact.phone) {
      jobs.push(
        this.notificationQueue.add('sendSMS', {
          phone: contact.phone,
          message: `Hi ${data.customerName}, ${line}`,
        }),
      );
    } else {
      this.logger.warn(
        `Skipping return-request SMS for order ${data.orderId} — no phone on file`,
      );
    }

    await Promise.all(jobs);
  }

  /** Queues the customer-facing email/SMS once a refund has been completed. */
  async sendRefundUpdate(
    contact: { email?: string | null; phone?: string | null },
    data: { orderId: string; customerName: string; amount: number },
  ) {
    const jobs: Promise<unknown>[] = [];

    if (contact.email) {
      jobs.push(
        this.notificationQueue.add('sendEmail', {
          email: contact.email,
          subject: `Refund processed for order #${data.orderId}`,
          template: 'refund-update',
          context: {
            customerName: data.customerName,
            orderId: data.orderId,
            amount: data.amount,
          },
        }),
      );
    } else {
      this.logger.warn(
        `Skipping refund-update email for order ${data.orderId} — no email on file`,
      );
    }

    if (contact.phone) {
      jobs.push(
        this.notificationQueue.add('sendSMS', {
          phone: contact.phone,
          message: `Hi ${data.customerName}, your refund of TK ${data.amount} for order #${data.orderId} has been processed.`,
        }),
      );
    } else {
      this.logger.warn(
        `Skipping refund-update SMS for order ${data.orderId} — no phone on file`,
      );
    }

    await Promise.all(jobs);
  }

  /** Queues a single digest email to every admin who currently has inventory access. */
  async sendLowStockAlert(
    adminEmails: string[],
    data: {
      outOfStock: LowStockAlertItem[];
      lowStock: LowStockAlertItem[];
      generatedAt: Date;
    },
  ) {
    if (adminEmails.length === 0) return;

    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? '';

    await this.notificationQueue.add('sendEmail', {
      email: adminEmails,
      subject: `Stock Alert: ${data.outOfStock.length} out of stock, ${data.lowStock.length} low on stock`,
      template: 'low-stock-alert',
      context: {
        outOfStock: data.outOfStock,
        lowStock: data.lowStock,
        generatedAt: data.generatedAt.toLocaleString('en-BD', {
          timeZone: 'Asia/Dhaka',
        }),
        dashboardUrl: `${frontendUrl}/admin/inventory?onlyLowStock=true`,
      },
    });
  }

  async processEmailJob(job: any) {
    const { email, subject, template, context } = job.data;

    // OTP keeps its existing Resend + hand-built-HTML path untouched.
    if (template === 'otp') {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const html = otpEmailTemplate(context.otp, context.purpose);
      try {
        await resend.emails.send({
          from: 'Ondorkotha <' + process.env.RESEND_FROM_EMAIL + '>',
          to: email,
          subject,
          html,
        });
        this.logger.log(`Email sent to ${email}`);
      } catch (err) {
        this.logger.error(`Failed to send email to ${email}`, err);
        throw err;
      }
      return;
    }

    // Every other templated email (order-confirmation, order-status-update,
    // low-stock-alert, ...) renders through the Handlebars templates already
    // wired up on MailerModule instead of needing pre-built HTML.
    try {
      await this.mailerService.sendMail({
        to: email,
        subject,
        template,
        context,
      });
      const recipients = Array.isArray(email) ? email.join(', ') : email;
      this.logger.log(
        `Email sent to ${recipients} using template "${template}"`,
      );
    } catch (err) {
      this.logger.error(`Failed to send email (template "${template}")`, err);
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
