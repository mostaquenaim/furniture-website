/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { Payment, PaymentMethod, PaymentStatus } from '@prisma/client';
import { PaymentMethodConfigService } from 'src/payment-method-config/payment-method-config.service';
import SSLCommerzPayment from 'sslcommerz-lts';

/**
 * Statuses that represent a payment which has already reached its final
 * outcome. Once a payment is in one of these, none of the callback/IPN
 * handlers should mutate it further — this is what makes duplicate IPN
 * deliveries and racing success/fail/cancel callbacks idempotent instead of
 * clobbering each other.
 */
const SETTLED_PAYMENT_STATUSES: PaymentStatus[] = [
  'PAID',
  'FAILED',
  'CANCELLED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
  'ON_HOLD',
];

export interface GatewayRefundResult {
  /** SSLCommerz's refund_ref_id — needed for later refundQuery polling. Null if the gateway didn't return one. */
  refundRefId: string | null;
  /** Our best-effort read of the gateway's refund status, lowercased. */
  status: string;
  raw: any;
}

@Injectable()
export class PaymentService {
  constructor(
    private readonly configService: ConfigService,
    private prisma: PrismaService,
    private paymentMethodConfigService: PaymentMethodConfigService,
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

    // If the order requires an advance (COD with an advance-payment subcategory),
    // only charge the deposit here — the rest is collected on delivery.
    const paymentAmount = order.advanceRequired
      ? order.advanceAmount
      : order.total;
    const phase = order.advanceRequired ? 'ADVANCE' : 'FULL';

    await this.paymentMethodConfigService.assertEnabled(
      PaymentMethod.SSL,
      paymentAmount,
    );

    // Create payment record
    const payment = await this.prisma.payment.create({
      data: {
        orderId: order.id,
        method: 'SSL',
        phase,
        amount: paymentAmount,
        paidAmount: 0,
        dueAmount: paymentAmount,
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
      total_amount: paymentAmount,
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

    // Idempotency guard: the success callback and the IPN both call this
    // method for the same transaction, and can arrive concurrently. If the
    // payment has already been settled, treat this as a duplicate delivery
    // rather than re-validating and re-applying order updates.
    if (SETTLED_PAYMENT_STATUSES.includes(payment.status)) {
      return payment;
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

      // Atomically claim this payment for finalization: the `status` filter
      // means only one of a racing success-callback/IPN pair can win this
      // update. The loser's count is 0, so it skips straight to the
      // already-settled return below instead of double-applying the order
      // update / status history that follows.
      const claim = await this.prisma.payment.updateMany({
        where: {
          id: payment.id,
          status: { notIn: SETTLED_PAYMENT_STATUSES },
        },
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

      const updatedPayment = await this.prisma.payment.findUniqueOrThrow({
        where: { id: payment.id },
      });

      if (claim.count === 0) {
        // Lost the race to a concurrent success/IPN call that already
        // finalized this payment — nothing left to do.
        return updatedPayment;
      }

      const isAdvancePayment = payment.phase === 'ADVANCE';

      // Update order status
      await this.prisma.order.update({
        where: { id: payment.orderId },
        data: {
          status: 'CONFIRMED',
          paymentStatus: isAdvancePayment ? 'PARTIALLY_PAID' : 'PAID',
          updatedAt: new Date(),
        },
      });

      // Create order status history
      await this.prisma.orderStatusHistory.create({
        data: {
          orderId: payment.orderId,
          status: 'CONFIRMED',
          note: isAdvancePayment
            ? `Advance payment (${payment.order.advancePercentage}%) received via SSL Commerz. Remaining ${payment.order.remainingAmount} due on delivery. Transaction ID: ${transactionId}`
            : `Payment received via SSL Commerz. Transaction ID: ${transactionId}`,
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

  /**
   * The `/payments/fail` and `/payments/cancel` endpoints are hit by the
   * customer's browser being redirected by SSLCommerz — there's no way to
   * authenticate that request (no session, no signature), so anyone who
   * learns or guesses a transactionId can POST to these URLs directly and
   * try to force a payment into FAILED/CANCELLED. Before trusting the
   * client-supplied redirect, confirm with SSLCommerz server-to-server
   * whether the transaction actually is settled successfully; if the
   * gateway disagrees, refuse to touch the payment and log it instead.
   *
   * Returns true if the gateway confirms the transaction is NOT a valid/paid
   * one (safe to mark failed/cancelled), false if it looks like a forged
   * request against a genuinely successful payment.
   */
  private async confirmNotActuallyPaidAtGateway(
    payment: Payment,
  ): Promise<boolean> {
    if (!payment.gatewayTranId) {
      // Nothing to check against — proceed as before rather than blocking
      // legitimate callbacks for payments that predate this field.
      return true;
    }

    try {
      const { storeId, storePassword, isLive } = this.getStoreConfig();
      const sslcz = new SSLCommerzPayment(storeId, storePassword, isLive);
      const query: any = await sslcz.transactionQueryByTransactionId({
        tran_id: payment.gatewayTranId,
      });

      const element = Array.isArray(query?.element)
        ? query.element[0]
        : query?.element;
      const gatewayStatus = String(
        element?.status ?? query?.status ?? '',
      ).toUpperCase();

      if (gatewayStatus === 'VALID' || gatewayStatus === 'VALIDATED') {
        await this.prisma.paymentLog.create({
          data: {
            paymentId: payment.id,
            action: 'FRAUD_ALERT',
            status: payment.status,
            message:
              'Fail/cancel callback received but SSLCommerz reports this transaction as valid — ignoring the callback',
            gatewayResponse: query,
          },
        });
        return false;
      }

      return true;
    } catch (error) {
      // Verification call itself failed (network/gateway issue) — fall back
      // to trusting the callback rather than leaving the payment stuck
      // PENDING forever, but record that verification wasn't possible.
      await this.prisma.paymentLog.create({
        data: {
          paymentId: payment.id,
          action: 'GATEWAY_VERIFY_ERROR',
          status: payment.status,
          message: `Could not verify transaction status with gateway before processing fail/cancel: ${error.message}`,
          gatewayResponse: { error: error.message },
        },
      });
      return true;
    }
  }

  // Fail handler
  async handlePaymentFail(transactionId: string, sslData: any): Promise<void> {
    const payment = await this.prisma.payment.findUnique({
      where: { transactionId },
    });

    if (!payment) return;

    // Idempotency + anti-downgrade guard: never let a fail callback clobber
    // a payment that's already settled (paid, refunded, already
    // failed/cancelled, or under manual review).
    if (SETTLED_PAYMENT_STATUSES.includes(payment.status)) return;

    if (!(await this.confirmNotActuallyPaidAtGateway(payment))) return;

    const claim = await this.prisma.payment.updateMany({
      where: { id: payment.id, status: { notIn: SETTLED_PAYMENT_STATUSES } },
      data: {
        status: 'FAILED',
        failedAt: new Date(),
        gatewayResponse: sslData,
      },
    });

    if (claim.count === 0) return;

    await this.prisma.paymentLog.create({
      data: {
        paymentId: payment.id,
        action: 'FAILED',
        status: 'FAILED',
        message: sslData?.error || 'Payment failed by user/gateway',
        gatewayResponse: sslData,
      },
    });
  }

  // Cancel handler
  async handlePaymentCancel(
    transactionId: string,
    sslData: any,
  ): Promise<void> {
    const payment = await this.prisma.payment.findUnique({
      where: { transactionId },
    });

    if (!payment) return;

    if (SETTLED_PAYMENT_STATUSES.includes(payment.status)) return;

    if (!(await this.confirmNotActuallyPaidAtGateway(payment))) return;

    const claim = await this.prisma.payment.updateMany({
      where: { id: payment.id, status: { notIn: SETTLED_PAYMENT_STATUSES } },
      data: {
        status: 'CANCELLED',
        gatewayResponse: sslData,
      },
    });

    if (claim.count === 0) return;

    await this.prisma.paymentLog.create({
      data: {
        paymentId: payment.id,
        action: 'CANCELLED',
        status: 'CANCELLED',
        message: 'Payment cancelled by user',
        gatewayResponse: sslData,
      },
    });
  }

  // IPN (Instant Payment Notification) handler
  async handleIPN(ipnData: any): Promise<void> {
    const { tran_id, status } = ipnData;

    // Find payment by gateway transaction ID
    const payment = await this.prisma.payment.findFirst({
      where: { gatewayTranId: tran_id },
    });

    if (!payment) {
      console.error(`Payment not found for transaction: ${tran_id}`);
      return;
    }

    // Check if already processed — covers all settled states, not just
    // PAID/FAILED, so a duplicate IPN can't re-trigger cancellation/refund
    // logic either.
    if (SETTLED_PAYMENT_STATUSES.includes(payment.status)) {
      return;
    }

    if (status === 'VALID' || status === 'VALIDATED') {
      await this.handlePaymentSuccess(payment.transactionId, ipnData);
    } else {
      await this.handlePaymentFail(payment.transactionId, ipnData);
    }
  }

  /**
   * Whether SSLCommerz's refund API can be used for this payment. `method`
   * alone isn't a reliable signal — handlePaymentSuccess rewrites it from
   * "SSL" to the actual sub-method (BKASH/NAGAD/ROCKET/card) once validated,
   * but those are still SSLCommerz-mediated and refundable through the same
   * API as long as a bank_tran_id was captured. Only COD (and anything that
   * never went through the gateway) lacks one.
   */
  isGatewayRefundable(payment: Payment): boolean {
    return !!(payment.metadata as any)?.cardDetails?.bankTranId;
  }

  /**
   * Calls SSLCommerz's refund API for a PAID/PARTIALLY_REFUNDED payment.
   * COD and any other payment without a captured bank_tran_id must go
   * through the manual refund path instead — see isGatewayRefundable.
   */
  async initiateGatewayRefund(
    payment: Payment,
    refundAmount: number,
    remarks: string,
  ): Promise<GatewayRefundResult> {
    const bankTranId = (payment.metadata as any)?.cardDetails?.bankTranId;
    if (!bankTranId) {
      throw new BadRequestException(
        'Cannot initiate gateway refund — this payment has no bank transaction ID on record',
      );
    }

    const { storeId, storePassword, isLive } = this.getStoreConfig();
    const sslcz = new SSLCommerzPayment(storeId, storePassword, isLive);

    // sslcommerz-lts's own httpCall does `.catch(err => err)` instead of
    // rethrowing — a non-JSON response (e.g. the sandbox returning an HTML
    // error page) resolves with the raw Error object rather than rejecting.
    // Normalize defensively either way: Error instances aren't valid Prisma
    // Json values, and an unparseable response must read as a failure, not
    // silently fall through to "still processing".
    let raw: unknown;
    try {
      raw = await sslcz.initiateRefund({
        refund_amount: refundAmount,
        refund_remarks: remarks,
        bank_tran_id: bankTranId,
        refe_id: payment.transactionId,
      });
    } catch (err) {
      raw = err;
    }

    const safeRaw = this.toSerializableGatewayResponse(raw);
    const statusText = String((safeRaw as any)?.status ?? '').toLowerCase();
    const failed =
      !statusText || statusText.includes('fail') || !!(safeRaw as any)?.error;

    await this.prisma.paymentLog.create({
      data: {
        paymentId: payment.id,
        action: 'REFUND_INITIATED',
        status: failed ? 'FAILED' : ((safeRaw as any)?.status ?? 'UNKNOWN'),
        message: `Gateway refund of ${refundAmount} initiated: ${remarks}`,
        gatewayResponse: safeRaw as any,
      },
    });

    return {
      refundRefId: (safeRaw as any)?.refund_ref_id ?? null,
      status: failed ? 'failed' : statusText || 'unknown',
      raw: safeRaw,
    };
  }

  /** Strips non-plain values (e.g. Error instances) so the result is always safe to store in a Prisma Json column. */
  private toSerializableGatewayResponse(value: unknown): unknown {
    if (value instanceof Error) {
      return { error: value.message, name: value.name };
    }
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return { error: 'Unserializable gateway response' };
    }
  }

  /** Polls SSLCommerz for the current state of a previously-initiated refund. */
  async queryGatewayRefundStatus(refundRefId: string): Promise<any> {
    const { storeId, storePassword, isLive } = this.getStoreConfig();
    const sslcz = new SSLCommerzPayment(storeId, storePassword, isLive);
    let raw: unknown;
    try {
      raw = await sslcz.refundQuery({ refund_ref_id: refundRefId });
    } catch (err) {
      raw = err;
    }
    return this.toSerializableGatewayResponse(raw);
  }
}
