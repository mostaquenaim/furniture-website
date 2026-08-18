/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { PartnerInventoryModule } from './partner-inventory/partner-inventory.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security middlewares
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Socket.IO adapter for the realtime inventory gateway (src/realtime/stock-events.gateway.ts)
  app.useWebSocketAdapter(new IoAdapter(app));

  // Validation Pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // prefix is set to "api"
  app.setGlobalPrefix('api');
  // Routes are now served under /api/v1, so future breaking changes can
  // ship as /api/v2 without touching existing integrations.
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Partner-only OpenAPI doc — scoped via `include` to PartnerInventoryModule
  // so no admin route ever appears here, regardless of what gets added to
  // the rest of the app later.
  const partnerDocConfig = new DocumentBuilder()
    .setTitle('Partner Inventory API')
    .setDescription(
      'Read-only, key-authenticated inventory feed for 3rd-party integrations. ' +
        'Authenticate with the `X-Api-Key` header.',
    )
    .setVersion('1.0')
    .addApiKey(
      { type: 'apiKey', name: 'X-Api-Key', in: 'header' },
      'ApiKeyAuth',
    )
    .build();
  const partnerDocument = SwaggerModule.createDocument(app, partnerDocConfig, {
    include: [PartnerInventoryModule],
  });
  SwaggerModule.setup('docs/partner', app, partnerDocument);

  // Without this, cookies + IPs can behave weird.
  // app.set('trust proxy', 1);
  // Listen AFTER all config
  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
