/* eslint-disable @typescript-eslint/no-unsafe-member-access */

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
  Version,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { CourierWebhookGuard } from './guards/courier.guard';
import type { Request, Response } from 'express';
import { CourierWebhookService } from './services/courier-webhook.service';

@Controller('webhook')
export class CourierWebhookController {
  private readonly logger = new Logger(CourierWebhookController.name);

  constructor(private readonly webhookService: CourierWebhookService) {}

  // Version-neutral: this URL is registered directly in each courier
  // provider's dashboard (e.g. Pathao), so it must not move to /v1, /v2, etc.
  @Version(VERSION_NEUTRAL)
  @Post('courier/:provider')
  @HttpCode(HttpStatus.OK)
  @UseGuards(CourierWebhookGuard)
  handleWebhook(
    @Param('provider') provider: string,
    @Body() payload: Record<string, any>,
    @Req() req: Request,
    @Res() res: Response,
  ) {
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
      return;
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
