import { Injectable } from '@nestjs/common';
import { SendEmailDto } from './send-email.dto';

@Injectable()
export class NotificationsService {
  sendEmail(dto: SendEmailDto) {
    // Mock: In real app, integrate with SMTP or SendGrid
    return { message: 'Email sent', payload: dto };
  }
}
