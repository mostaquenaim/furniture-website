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
import * as Handlebars from 'handlebars';
import { otpEmailTemplate } from './templates/otp.template';
import { PrismaService } from 'src/prisma/prisma.service';
import axios from 'axios';

export interface LowStockAlertItem {
  productTitle: string;
  sku: string | null;
  size: string;
  color: string;
  quantity: number;
  lowStockAt: number;
}

export interface StalePieceAlertItem {
  productTitle: string;
  color: string;
  size: string;
  batchId: string;
  pending: number;
  quantity: number;
  ageDays: number;
}

@Injectable()
export class NotificationsService {
  private logger = new Logger('NotificationService');

  constructor(
    private mailerService: MailerService,
    private config: ConfigService,
    private prisma: PrismaService,
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
  }

  async sendPickSlip(
    email: string,
    orderId: string,
    lines: {
      barcodeValue: string;
      productTitle: string;
      color: string;
      size: string;
      locationCode: string | null;
    }[],
  ) {
    await this.notificationQueue.add('sendEmail', {
      email,
      subject: `Pick Slip — ${orderId}`,
      template: 'pick-slip',
      context: { orderId, lines },
    });
  }

  /**
   * Queues the customer-facing email for an order status change. SMS is
   * reserved for OTP only, so this is email-only despite the contact param
   * still accepting phone. Never throws: a missing email just skips the send
   * (logged by the caller's catch, if any).
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

    await Promise.all(jobs);
  }

  /**
   * Queues the customer-facing email for a return-request lifecycle event
   * (filed, approved, rejected, item received). Same email-only, never-throws
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
    // Each event has its own DB-editable template (return-request-submitted,
    // -approved, -rejected, -item-received); "template" stays the shared
    // on-disk .hbs filename used only if a DB row is ever missing.
    const templateKey = `return-request-${data.event.toLowerCase().replace(/_/g, '-')}`;
    const jobs: Promise<unknown>[] = [];

    if (contact.email) {
      jobs.push(
        this.notificationQueue.add('sendEmail', {
          email: contact.email,
          subject,
          template: 'return-request-update',
          templateKey,
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

    await Promise.all(jobs);
  }

  /** Queues the customer-facing email once a refund has been completed. */
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

    await Promise.all(jobs);
  }

  /** Queues the customer-facing email when a staff member replies on a support ticket. */
  async sendTicketReplyNotification(
    user: { email?: string | null },
    data: {
      ticketId: number | string;
      subject: string;
      replyPreview: string;
      ticketUrl: string;
    },
  ) {
    const jobs: Promise<unknown>[] = [];

    if (user.email) {
      jobs.push(
        this.notificationQueue.add('sendEmail', {
          email: user.email,
          subject: `New reply on your support ticket #${data.ticketId}`,
          template: 'ticket-reply',
          context: {
            customerName: 'there',
            ticketId: data.ticketId,
            subject: data.subject,
            replyPreview: data.replyPreview,
            ticketUrl: data.ticketUrl,
          },
        }),
      );
    } else {
      this.logger.warn(
        `Skipping ticket-reply email for ticket ${data.ticketId} — no email on file`,
      );
    }

    await Promise.all(jobs);
  }

  /**
   * Queues one offer/promotional email per recipient (never a single email
   * with every address in "to", which would leak addresses between
   * customers). Returns the number of emails queued.
   */
  async sendOfferEmail(
    recipients: { email: string; name?: string | null }[],
    offer: {
      subject: string;
      heading: string;
      message: string;
      ctaLabel?: string;
      ctaUrl?: string;
    },
  ) {
    await Promise.all(
      recipients.map((recipient) =>
        this.notificationQueue.add('sendEmail', {
          email: recipient.email,
          subject: offer.subject,
          template: 'offer',
          context: {
            customerName: recipient.name || 'there',
            heading: offer.heading,
            message: offer.message,
            ctaLabel: offer.ctaLabel,
            ctaUrl: offer.ctaUrl,
          },
        }),
      ),
    );

    return recipients.length;
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

  /** Queues a single digest email listing barcode batches stuck in CREATED past the stale threshold. */
  async sendStalePiecesAlert(
    adminEmails: string[],
    data: { items: StalePieceAlertItem[]; thresholdDays: number; generatedAt: Date },
  ) {
    if (adminEmails.length === 0) return;

    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? '';

    await this.notificationQueue.add('sendEmail', {
      email: adminEmails,
      subject: `${data.items.length} barcode batch(es) still unreceived after ${data.thresholdDays}+ days`,
      template: 'stale-pieces-alert',
      context: {
        items: data.items,
        thresholdDays: data.thresholdDays,
        generatedAt: data.generatedAt.toLocaleString('en-BD', {
          timeZone: 'Asia/Dhaka',
        }),
        dashboardUrl: `${frontendUrl}/admin/pieces`,
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
    // low-stock-alert, ...) is admin-editable: look up the EmailTemplate row
    // (keyed by job.data.templateKey, falling back to job.data.template for
    // the templates that don't split by sub-event) and render it with
    // Handlebars. "offer" keeps its caller-supplied subject — it's a one-off
    // campaign, not a fixed template. If the row is missing for any reason,
    // fall back to the on-disk .hbs file + hardcoded subject so sending never
    // breaks.
    const templateKey: string = job.data.templateKey ?? template;
    let renderedSubject = subject;
    let renderedHtml: string | undefined;

    try {
      const row = await this.prisma.emailTemplate.findUnique({
        where: { key: templateKey },
      });
      if (row) {
        if (template !== 'offer') {
          renderedSubject = Handlebars.compile(row.subject)(context);
        }
        renderedHtml = Handlebars.compile(row.body)(context);
      }
    } catch (err) {
      this.logger.warn(
        `Failed to load email template "${templateKey}", falling back to on-disk template`,
        err,
      );
    }

    try {
      if (renderedHtml) {
        await this.mailerService.sendMail({
          to: email,
          subject: renderedSubject,
          html: renderedHtml,
        });
      } else {
        await this.mailerService.sendMail({
          to: email,
          subject: renderedSubject,
          template,
          context,
        });
      }
      const recipients = Array.isArray(email) ? email.join(', ') : email;
      this.logger.log(
        `Email sent to ${recipients} using template "${templateKey}"`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to send email (template "${templateKey}")`,
        err,
      );
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
