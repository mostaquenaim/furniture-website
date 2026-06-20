/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { ValidationPipe } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';

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
  // Without this, cookies + IPs can behave weird.
  // app.set('trust proxy', 1);
  // Listen AFTER all config
  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
