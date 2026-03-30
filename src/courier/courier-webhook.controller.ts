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
import { CourierWebhookGuard } from './guards/courier.guard';
import type { Request, Response } from 'express';
import { CourierWebhookService } from './services/courier-webhook.service';

@Controller('webhook')
export class CourierWebhookController {
  private readonly logger = new Logger(CourierWebhookController.name);

  constructor(private readonly webhookService: CourierWebhookService) {}

  @Post('courier/:provider')
  @HttpCode(HttpStatus.OK)
  @UseGuards(CourierWebhookGuard)
  handleWebhook(
    @Param('provider') provider: string,
    @Body() payload: Record<string, any>,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    // console.log('pathao - data', provider, payload, 'pathaao-data');
    const incomingSecret = req.headers[
      'x-pathao-merchant-webhook-integration-secret'
    ] as string | undefined;

    if (incomingSecret) {
      res.setHeader(
        'X-Pathao-Merchant-Webhook-Integration-Secret',
        incomingSecret,
      );
    }

    if (payload?.event === 'webhook_integration') {
      this.logger.log(
        `Pathao webhook handshake received for provider="${provider}"`,
      );
      res.status(HttpStatus.ACCEPTED).json({ received: true });
    }

    // Always return { received: true } — never expose internal errors to Pathao
    this.webhookService
      .handleWebhook(provider, payload, req)
      .catch((err) =>
        this.logger.error(
          `Webhook background processing error: ${err.message}`,
          err.stack,
        ),
      );

    res.status(HttpStatus.ACCEPTED).json({ received: true });
  }
}
