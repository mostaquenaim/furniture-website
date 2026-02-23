/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  Controller,
  Post,
  Body,
  Get,
  Res,
  Header,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { SSLInitiateDto } from './dto/ssl-initiate.dto';
import { SSLVerifyDto } from './dto/ssl-verify.dto';
import { BkashCreateDto } from './dto/bkash-create.dto';
import { BkashExecuteDto } from './dto/bkash-execute.dto';
import { BkashQueryDto } from './dto/bkash-query.dto';
import type { Response } from 'express';

@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('sslcommerz/initiate/:orderId')
  @Header('Access-Control-Allow-Origin', '*')
  async initiateSSL(@Param('orderId', ParseIntPipe) orderId: number) {
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

  @Post('sslcommerz/verify')
  verifySSL(@Body() dto: SSLVerifyDto) {
    return this.paymentService.verifySSL(dto);
  }

  @Post('bkash/create')
  createBkash(@Body() dto: BkashCreateDto) {
    return this.paymentService.createBkash(dto);
  }

  @Post('bkash/execute')
  executeBkash(@Body() dto: BkashExecuteDto) {
    return this.paymentService.executeBkash(dto);
  }

  @Post('bkash/query')
  queryBkash(@Body() dto: BkashQueryDto) {
    return this.paymentService.queryBkash(dto);
  }

  @Get('methods')
  paymentMethods() {
    return this.paymentService.getMethods();
  }
}
