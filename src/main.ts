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
    origin: ['http://localhost:7000', 'http://127.0.0.1:8000', 'https://sakigaibd.draft'],
    credentials: true,
  });

  //  app.enableCors({
  //   origin: [
  //     'http://127.0.0.1:8000',
  //     'http://localhost:8000',
  //     'https://tahamsbd.com',
  //   ],
  //   methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  //   credentials: true,
  // });
  
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
