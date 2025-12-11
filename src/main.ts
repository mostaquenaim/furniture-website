/* eslint-disable @typescript-eslint/no-unsafe-call */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security middlewares
  app.use(helmet());

  // CORS
  app.enableCors({
    origin: ['http://localhost:3000', 'https://sakigaibd.draft'],
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
  // Listen AFTER all config
  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
