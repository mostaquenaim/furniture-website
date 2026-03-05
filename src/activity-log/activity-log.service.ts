/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { LogModule } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

// src/activity-log/activity-log.service.ts
@Injectable()
export class ActivityLogService {
  constructor(private prisma: PrismaService) {}

  async log(data: {
    adminId: number;
    action: string;
    module: LogModule;
    targetId?: string | number;
    targetLabel?: string;
    metadata?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
  }) {
    try {
      await this.prisma.activityLog.create({
        data: {
          adminId: data.adminId,
          action: data.action,
          module: data.module,
          targetId: data.targetId ? String(data.targetId) : null,
          targetLabel: data.targetLabel,
          metadata: data.metadata,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
        },
      });
    } catch (err) {
      // never let logging break the main flow
      console.error('ActivityLog failed:', err);
    }
  }
}
