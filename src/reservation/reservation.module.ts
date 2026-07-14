// src/reservation/reservation.module.ts
import { Module } from '@nestjs/common';
import { ReservationController } from './reservation.controller';
import { ReservationService } from './reservation.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from 'src/prisma/prisma.service';
import { PermissionService } from 'src/permission/permission.service';
import { ActivityLogService } from 'src/activity-log/activity-log.service';

@Module({
  imports: [PrismaModule],
  controllers: [ReservationController],
  providers: [
    ReservationService,
    PrismaService,
    PermissionService,
    ActivityLogService,
  ],
  exports: [ReservationService],
})
export class ReservationModule {}
