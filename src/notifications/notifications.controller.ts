import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { SkipPermission } from 'src/permission/skip-permission.decorator';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import { SendOfferDto } from './dto/send-offer.dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('send-offer')
  @SkipPermission()
  async sendOffer(@Body() dto: SendOfferDto) {
    const recipients = await this.prisma.user.findMany({
      where: { email: { not: null }, isActive: true },
      select: { email: true, name: true },
    });

    const queued = await this.notificationsService.sendOfferEmail(
      recipients as { email: string; name?: string | null }[],
      dto,
    );

    return { queued };
  }
}
