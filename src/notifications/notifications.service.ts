/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// notification.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { MailerService } from '@nestjs-modules/mailer';
// import Twilio from 'twilio';
// import { ConfigService } from '@nestjs/config';

@Injectable()
export class NotificationsService {
  private logger = new Logger('NotificationService');
  // private twilioClient: Twilio.Twilio;

  constructor(
    private mailerService: MailerService,
    // private config: ConfigService,
    @InjectQueue('notification') private notificationQueue: Queue,
  ) {
    // this.twilioClient = Twilio(
    //   this.config.getOrThrow('TWILIO_SID'),
    //   this.config.getOrThrow('TWILIO_AUTH_TOKEN'),
    // );
  }

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
    // console.log(job.data, 'jobss2');
    try {
      await this.mailerService.sendMail({
        to: job.data.email,
        // subject: 'Sakigai Notification',
        subject: job.data.subject,
        template: job.data.template,
        context: job.data.context,
      });
      this.logger.log(`Email sent to ${job.data.email}`);
    } catch (err) {
      this.logger.error(`Failed to send email to ${job.data.email}`, err);
      throw err;
    }
  }

  processSMSJob(job: any) {
    try {
      // await this.twilioClient.messages.create({
      //   to: job.data.phone,
      //   from: process.env.TWILIO_PHONE,
      //   body: job.data.message,
      // });

      this.logger.log(`SMS sent to ${job.data.phone}`);
    } catch (err) {
      this.logger.error(`Failed to send SMS to ${job.data.phone}`, err);
      throw err;
    }
  }
}
