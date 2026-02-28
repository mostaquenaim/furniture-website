/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// notification.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { MailerModule } from '@nestjs-modules/mailer';
import { join } from 'path';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { NotificationsService } from './notifications.service';
import { NotificationProcessor } from './notification.processor';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'notification' }),
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        transport: {
          host: config.getOrThrow<string>('SMTP_HOST'),
          port: config.getOrThrow<number>('SMTP_PORT'),
          secure: config.getOrThrow<string>('SMTP_PORT') === '465', // true for 465, false for other ports
          auth: {
            user: config.getOrThrow<string>('SMTP_USER'),
            pass: config.getOrThrow<string>('SMTP_PASS'),
          },
        },
        defaults: {
          from: `"Sakigai" <${process.env.MAIL_FROM}>`,
        },
        preview: process.env.NODE_ENV === 'development',
        template: {
          dir: join(__dirname, 'templates'),
          adapter: new HandlebarsAdapter(),
          options: {
            strict: true,
          },
        },
      }),
    }),
  ],
  providers: [NotificationsService, NotificationProcessor],
  exports: [NotificationsService],
})
export class NotificationModule {}
