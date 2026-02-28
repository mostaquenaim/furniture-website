import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import { NotificationsService } from './notifications.service';

@Processor('notification')
export class NotificationProcessor {
  constructor(private readonly notificationService: NotificationsService) {}

  @Process('sendEmail')
  async handleEmail(job: Job) {
    // console.log(job, 'jobss');
    return this.notificationService.processEmailJob(job);
  }

  @Process('sendSMS')
  handleSMS(job: Job) {
    return this.notificationService.processSMSJob(job);
  }
}
