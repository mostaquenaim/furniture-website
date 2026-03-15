/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
// src/courier/courier.controller.ts
import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Param,
  Req,
  Res,
  Logger,
} from '@nestjs/common';
import { CourierService } from './courier.service';
import { CourierWebhookGuard } from './guards/courier.guard';
import type { Request, Response } from 'express';

@Controller('courier')
export class CourierController {

  constructor(private readonly courierService: CourierService) {}

  @Get('providers')
  getProviders() {
    return this.courierService.getProviders();
  }
}
