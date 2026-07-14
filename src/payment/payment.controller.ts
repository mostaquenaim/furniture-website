/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  Controller,
  Post,
  Param,
  UseGuards,
  Query,
  Body,
  Res,
  Version,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';

@Controller('payments')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly configService: ConfigService,
  ) {}

  @Post('sslcommerz/initiate/:orderId')
  @UseGuards(JwtAuthGuard)
  async initiateSSL(@Param('orderId') orderId: string) {
  // console.log('here');
    try {
      const sslcommerzURL = await this.paymentService.initiateSSL(orderId);
      return {
        success: true,
        data: {
          redirectUrl: sslcommerzURL,
          GatewayPageURL: sslcommerzURL,
          orderId: orderId,
        },
        message: 'Payment initialized successfully',
      };
    } catch (error) {
      console.error('Payment controller error:', error);
      return {
        success: false,
        message: error.message || 'Payment initialization failed',
      };
    }
  }

  // Version-neutral: SSLCommerz is given this exact URL at transaction
  // initiation time, so it must keep working across API version bumps.
  @Version(VERSION_NEUTRAL)
  @Post('success')
  async success(
    @Query('transactionId') transactionId: string,
    @Body() body: any,
    @Res() res: Response,
  ) {
    await this.paymentService.handlePaymentSuccess(transactionId, body);

    const frontendUrl = this.configService.get<string>('FRONTEND_URL');

    // Redirect to frontend success page
    return res.redirect(
      `${frontendUrl}/payment/payment-success?transactionId=${transactionId}`,
    );
  }

  @Version(VERSION_NEUTRAL)
  @Post('fail')
  async fail(
    @Query('transactionId') transactionId: string,
    @Query('orderId') orderId: string,
    @Body() body: any,
    @Res() res: Response,
  ) {
    await this.paymentService.handlePaymentFail(transactionId, body);

    const frontendUrl = this.configService.get<string>('FRONTEND_URL');

    return res.redirect(
      `${frontendUrl}/payment/payment-failed?transactionId=${transactionId}&orderId=${orderId}`,
    );
  }

  @Version(VERSION_NEUTRAL)
  @Post('cancel')
  async cancel(
    @Query('transactionId') transactionId: string,
    @Query('orderId') orderId: string,
    @Body() body: any,
    @Res() res: Response,
  ) {
    await this.paymentService.handlePaymentCancel(transactionId, body);

    const frontendUrl = this.configService.get<string>('FRONTEND_URL');

    return res.redirect(
      `${frontendUrl}/payment/payment-cancelled?transactionId=${transactionId}&orderId=${orderId}`,
    );
  }

  @Version(VERSION_NEUTRAL)
  @Post('ipn')
  async ipn(@Body() body: any) {
    await this.paymentService.handleIPN(body);
    return { received: true };
  }
}
