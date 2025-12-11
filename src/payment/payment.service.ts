/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { SSLInitiateDto } from './dto/ssl-initiate.dto';
import { SSLVerifyDto } from './dto/ssl-verify.dto';
import { BkashCreateDto } from './dto/bkash-create.dto';
import { BkashExecuteDto } from './dto/bkash-execute.dto';
import { BkashQueryDto } from './dto/bkash-query.dto';

@Injectable()
export class PaymentService {

  // SSLCommerz – Initiate
  initiateSSL(dto: SSLInitiateDto) {
    return { message: 'SSLCommerz initiated', payload: dto };
  }

  // SSLCommerz – Verify
  verifySSL(dto: SSLVerifyDto) {
    return { message: 'SSLCommerz payment verified', payload: dto };
  }

  // bKash – Create
  createBkash(dto: BkashCreateDto) {
    return { message: 'bKash payment created', payload: dto };
  }

  // bKash – Execute
  executeBkash(dto: BkashExecuteDto) {
    return { message: 'bKash payment executed', payload: dto };
  }

  // bKash – Query
  queryBkash(dto: BkashQueryDto) {
    return { message: 'bKash payment queried', payload: dto };
  }

  // Payment methods
  getMethods() {
    return {
      methods: [
        'sslcommerz',
        'bkash',
        'cash_on_delivery',
        'emi',
        'partial_payment',
      ],
    };
  }
}
