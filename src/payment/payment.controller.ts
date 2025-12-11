import { Controller, Post, Body, Get } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { SSLInitiateDto } from './dto/ssl-initiate.dto';
import { SSLVerifyDto } from './dto/ssl-verify.dto';
import { BkashCreateDto } from './dto/bkash-create.dto';
import { BkashExecuteDto } from './dto/bkash-execute.dto';
import { BkashQueryDto } from './dto/bkash-query.dto';

@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('sslcommerz/initiate')
  initiateSSL(@Body() dto: SSLInitiateDto) {
    return this.paymentService.initiateSSL(dto);
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
