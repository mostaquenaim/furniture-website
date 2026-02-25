/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security middlewares
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // CORS
  // app.enableCors({
  //   origin: (origin, callback) => {
  //     const allowedOrigins = [
  //       'http://localhost:7000',
  //       'http://127.0.0.1:7000',
  //       'https://furniture-frontend-iota.vercel.app',
  //     ];

  //     // Allow server-to-server requests
  //     if (!origin) return callback(null, true);

  //     // Allow SSLCommerz sandbox + live
  //     if (
  //       allowedOrigins.includes(origin) ||
  //       origin.endsWith('.vercel.app') ||
  //       origin.includes('sslcommerz.com')
  //     ) {
  //       return callback(null, true);
  //     }

  //     return callback(new Error('Not allowed by CORS'));
  //   },
  //   credentials: true,
  // });

  app.enableCors({
    origin: true,
    credentials: true,
  });

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
