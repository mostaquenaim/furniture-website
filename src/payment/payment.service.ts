/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import SSLCommerzPayment from 'sslcommerz-lts';

@Injectable()
export class PaymentService {
  constructor(
    private readonly configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  private mapGatewayMethod(cardType: string): any {
    const method = cardType.toLowerCase();
    if (method.includes('bkash')) return 'BKASH';
    if (method.includes('nagad')) return 'NAGAD';
    if (method.includes('rocket')) return 'ROCKET';
    // Fallback to SSL or generic card if it's VISA/MASTER
    return 'SSL';
  }

  // SSLCommerz – Initiate

  private getStoreConfig() {
    const storeId = this.configService.get<string>('SSLCOMMERZ_STORE_ID');
    const storePassword = this.configService.get<string>(
      'SSLCOMMERZ_STORE_PASSWORD',
    );
    const isLive =
      this.configService.get<string>('SSLCOMMERZ_IS_LIVE') === 'true';

    if (!storeId || !storePassword) {
      throw new Error('SSLCommerz credentials are not configured');
    }
    return { storeId, storePassword, isLive };
  }

  async initiateSSL(
    orderId: string,
  ): Promise<{ gatewayPageUrl: string; transactionId: string }> {
    const { storeId, storePassword, isLive } = this.getStoreConfig();

    // Generate unique transaction ID
    const transactionId = `SSL_${orderId}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const gatewayTranId = `TXN_${Date.now()}_${orderId}`;

    const order = await this.prisma.order.findUnique({
      where: { orderId: orderId },
      include: {
        user: true,
        district: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!order) {
      throw new BadRequestException('Order not found');
    }

    // Check if order is already paid or has pending payment
    const existingPayment = await this.prisma.payment.findFirst({
      where: {
        orderId: order.id,
        status: { in: ['PENDING', 'PROCESSING', 'PAID'] },
      },
    });

    if (existingPayment) {
      if (existingPayment.status === 'PAID') {
        throw new BadRequestException('Order already paid');
      }
      // Return existing payment if still pending/processing
      const gatewayPageUrl =
        (existingPayment.gatewayResponse as any)?.GatewayPageURL || '';

      return {
        gatewayPageUrl: gatewayPageUrl,
        transactionId: existingPayment.transactionId,
      };
    }

    // Create payment record
    const payment = await this.prisma.payment.create({
      data: {
        orderId: order.id,
        method: 'SSL',
        amount: order.total,
        paidAmount: 0,
        dueAmount: order.total,
        transactionId,
        gatewayTranId,
        status: 'PENDING',
        verificationStatus: 'UNVERIFIED',
        riskLevel: 'LOW',
        initiatedAt: new Date(),
        metadata: {
          customerInfo: {
            name: order.customerName,
            phone: order.customerPhone,
            email: order.customerEmail,
          },
          orderItems: order.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.priceAtPurchase,
          })),
        },
        paymentLogs: {
          create: {
            action: 'INITIATED',
            status: 'PENDING',
            message: 'Payment initiation started',
            createdBy: order.userId || undefined,
          },
        },
      },
    });

    const BASE_URL = this.configService.get<string>('BASE_URL');

    // Prepare SSL Commerz data
    const data: any = {
      total_amount: order.total,
      currency: 'BDT',
      tran_id: gatewayTranId, // Use gatewayTranId for SSL
      success_url: `${BASE_URL}/api/payments/success?transactionId=${transactionId}`,
      fail_url: `${BASE_URL}/api/payments/fail?transactionId=${transactionId}&orderId=${orderId}`,
      cancel_url: `${BASE_URL}/api/payments/cancel?transactionId=${transactionId}&orderId=${orderId}`,
      ipn_url: `${BASE_URL}/api/payments/ipn`,

      // Customer information
      cus_name: order.customerName,
      cus_phone: order.customerPhone,
      cus_email: order.customerEmail || '',
      cus_add1: order.shippingAddress,
      cus_city: order.districtName || 'Dhaka',
      cus_country: 'Bangladesh',

      // Shipping information
      shipping_method: order.deliveryMethod || 'Courier',
      ship_name: order.customerName,
      ship_add1: order.shippingAddress,
      ship_city: order.districtName || 'Dhaka',
      ship_country: 'Bangladesh',
      ship_postcode: order.postCode || '1000',

      // Product information
      product_name: order.items.map((item) => item.productTitle).join(', '),
      product_category: 'General',
      product_profile: 'general',

      // Additional information
      value_a: orderId.toString(),
      value_b: transactionId,
      value_c: payment.id.toString(),
    };

    // Add EMI options if total is above threshold
    // if (order.total >= 5000) {
    //   data.emi_option = 1;
    // }

    try {
      const sslcz = new SSLCommerzPayment(storeId, storePassword, isLive);
      const apiResponse = await sslcz.init(data);

      // Create payment log
      await this.prisma.paymentLog.create({
        data: {
          paymentId: payment.id,
          action: 'GATEWAY_INIT',
          status: apiResponse.status === 'SUCCESS' ? 'SUCCESS' : 'FAILED',
          message:
            apiResponse.status === 'SUCCESS'
              ? `Gateway session created: ${apiResponse.sessionkey}`
              : `Gateway error: ${apiResponse.failedreason}`,
          gatewayResponse: apiResponse,
          createdBy: order.userId || undefined,
        },
      });

      if (!apiResponse.GatewayPageURL || apiResponse.status !== 'SUCCESS') {
        // Update payment status to failed
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: 'FAILED',
            failedAt: new Date(),
            gatewayResponse: apiResponse,
            paymentLogs: {
              create: {
                action: 'FAILED',
                status: 'FAILED',
                message:
                  apiResponse.failedreason ||
                  'Failed to initialize payment gateway',
                gatewayResponse: apiResponse,
              },
            },
          },
        });

        throw new BadRequestException(
          apiResponse.failedreason || 'Failed to initialize payment',
        );
      }

      // Update payment with gateway response
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'PROCESSING',
          gatewayResponse: apiResponse,
          metadata: {
            ...(payment.metadata as any),
            gatewayPageUrl: apiResponse.GatewayPageURL,
            sessionKey: apiResponse.sessionkey,
          },
        },
      });

      return {
        gatewayPageUrl: apiResponse.GatewayPageURL,
        transactionId,
      };
    } catch (error) {
      // Log error and update payment status
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          paymentLogs: {
            create: {
              action: 'ERROR',
              status: 'FAILED',
              message: error.message || 'Payment initiation error',
              gatewayResponse: { error: error.message },
            },
          },
        },
      });

      throw new BadRequestException(
        `Payment initiation failed: ${error.message}`,
      );
    }
  }

  // Success handler
  async handlePaymentSuccess(
    transactionId: string,
    sslData: any,
  ): Promise<any> {
    const payment = await this.prisma.payment.findUnique({
      where: { transactionId },
      include: { order: true },
    });

    if (!payment) {
      throw new BadRequestException('Payment not found');
    }

    // Verify payment with SSL Commerz
    const { storeId, storePassword, isLive } = this.getStoreConfig();
    const sslcz = new SSLCommerzPayment(storeId, storePassword, isLive);

    try {
      const validationResponse = await sslcz.validate({
        val_id: sslData.val_id,
      });

      // Create payment log
      await this.prisma.paymentLog.create({
        data: {
          paymentId: payment.id,
          action: 'VALIDATION',
          status: validationResponse.status === 'VALID' ? 'SUCCESS' : 'FAILED',
          message: 'Payment validation from gateway',
          gatewayResponse: validationResponse,
        },
      });

      if (validationResponse.status !== 'VALID') {
        // Payment validation failed
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: 'FAILED',
            verificationStatus: 'VERIFICATION_FAILED',
            failedAt: new Date(),
            rawResponse: validationResponse,
          },
        });

        throw new BadRequestException('Payment validation failed');
      }

      // Verify amount matches
      if (Math.abs(validationResponse.amount - payment.amount) > 1) {
        // Amount mismatch - potential fraud
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: 'ON_HOLD',
            verificationStatus: 'PENDING_REVIEW',
            riskLevel: 'HIGH',
            rawResponse: validationResponse,
            paymentLogs: {
              create: {
                action: 'FRAUD_ALERT',
                status: 'ON_HOLD',
                message: 'Amount mismatch detected',
              },
            },
          },
        });

        throw new BadRequestException(
          'Payment verification failed: Amount mismatch',
        );
      }

      const actualMethod = this.mapGatewayMethod(validationResponse.card_type);

      // Update payment as successful
      const updatedPayment = await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'PAID',
          method: actualMethod,
          verificationStatus: 'VERIFIED',
          paidAmount: Number(validationResponse.amount),
          dueAmount: 0,
          verifiedAt: new Date(),
          completedAt: new Date(),
          gatewayRefId: validationResponse.val_id,
          rawResponse: validationResponse,
          metadata: {
            ...(payment.metadata as any),
            validationData: validationResponse,
            cardDetails: {
              cardType: validationResponse.card_type,
              cardNo: validationResponse.card_no,
              bankTranId: validationResponse.bank_tran_id,
            },
          },
        },
      });

      // Update order status
      await this.prisma.order.update({
        where: { id: payment.orderId },
        data: {
          status: 'CONFIRMED',
          paymentStatus: 'PAID',
          updatedAt: new Date(),
        },
      });

      // Create order status history
      await this.prisma.orderStatusHistory.create({
        data: {
          orderId: payment.orderId,
          status: 'CONFIRMED',
          note: `Payment received via SSL Commerz. Transaction ID: ${transactionId}`,
        },
      });

      return updatedPayment;
    } catch (error) {
      // Log validation error
      await this.prisma.paymentLog.create({
        data: {
          paymentId: payment.id,
          action: 'VALIDATION_ERROR',
          status: 'FAILED',
          message: error.message,
          gatewayResponse: { error: error.message },
        },
      });

      throw error;
    }
  }

  // Fail handler
  async handlePaymentFail(transactionId: string, sslData: any): Promise<void> {
    const payment = await this.prisma.payment.findUnique({
      where: { transactionId },
    });

    if (payment) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          gatewayResponse: sslData,
          paymentLogs: {
            create: {
              action: 'FAILED',
              status: 'FAILED',
              message: sslData.error || 'Payment failed by user/gateway',
              gatewayResponse: sslData,
            },
          },
        },
      });
    }
  }

  // Cancel handler
  async handlePaymentCancel(
    transactionId: string,
    sslData: any,
  ): Promise<void> {
    const payment = await this.prisma.payment.findUnique({
      where: { transactionId },
    });

    if (payment) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'CANCELLED',
          gatewayResponse: sslData,
          paymentLogs: {
            create: {
              action: 'CANCELLED',
              status: 'CANCELLED',
              message: 'Payment cancelled by user',
              gatewayResponse: sslData,
            },
          },
        },
      });
    }
  }

  // IPN (Instant Payment Notification) handler
  async handleIPN(ipnData: any): Promise<void> {
    const { tran_id, val_id, status, amount } = ipnData;

    // Find payment by gateway transaction ID
    const payment = await this.prisma.payment.findFirst({
      where: { gatewayTranId: tran_id },
    });

    if (!payment) {
      console.error(`Payment not found for transaction: ${tran_id}`);
      return;
    }

    // Check if already processed
    if (payment.status === 'PAID' || payment.status === 'FAILED') {
      return;
    }

    if (status === 'VALID') {
      await this.handlePaymentSuccess(payment.transactionId, ipnData);
    } else {
      await this.handlePaymentFail(payment.transactionId, ipnData);
    }
  }
}
