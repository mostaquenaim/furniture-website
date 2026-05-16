/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { BadRequestException, Injectable } from '@nestjs/common';
import {
  ActivityLog,
  LogModule,
  LogSeverity,
  LogStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

// src/activity-log/activity-log.service.ts
@Injectable()
export class ActivityLogService {
  constructor(private prisma: PrismaService) {}

  // create log
  async log(data: {
    adminId: number;
    action: string;
    status?: LogStatus;
    severity?: LogSeverity;
    module: LogModule;
    targetId?: string | number;
    targetLabel: string;
    metadata?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
    oldValue?: Prisma.InputJsonValue;
    newValue?: Prisma.InputJsonValue;
  }) {
    try {
      const statement = await this.getLogStatement({
        adminId: data.adminId,
        action: data.action,
        targetLabel: data.targetLabel,
      });

      await this.prisma.activityLog.create({
        data: {
          adminId: data.adminId,
          action: data.action,
          module: data.module,
          status: data.status ?? 'SUCCESS',
          severity: data.severity ?? 'INFO',
          oldValue: data.oldValue,
          newValue: data.newValue,
          targetId: data.targetId ? String(data.targetId) : null,
          targetLabel: data.targetLabel,
          metadata: data.metadata ? Prisma.JsonNull : data.metadata,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          statement,
        },
      });
    } catch (err) {
      // Never let logging break the main flow
      console.error('ActivityLog failed:', err);
    }
  }

  private async getLogStatement({
    adminId,
    action,
    targetLabel,
    module,
  }: {
    adminId: number;
    action: string;
    targetLabel: string;
    module?: LogModule; // Optional module context
  }) {
    try {
      const admin = await this.prisma.user.findUnique({
        where: { id: adminId },
        select: { name: true },
      });

      const adminName = admin?.name ?? 'A system administrator';

      // Parse action parts
      const actionParts = action.split('_');
      const verb = actionParts[0].toLowerCase();
      const subject = actionParts.slice(1).join(' ').toLowerCase();

      // Handle different action formats
      const actionMap: Record<string, string> = {
        create: 'created',
        update: 'updated',
        delete: 'deleted',
        view: 'viewed',
        export: 'exported',
        import: 'imported',
        approve: 'approved',
        reject: 'rejected',
        cancel: 'cancelled',
        assign: 'assigned',
        remove: 'removed',
        enable: 'enabled',
        disable: 'disabled',
        login: 'logged into',
        logout: 'logged out of',
        upload: 'uploaded',
        download: 'downloaded',
      };

      const formattedVerb = actionMap[verb] || `${verb}ed`;

      // Format the target
      const formattedTarget = targetLabel ? ` "${targetLabel}"` : '';

      // Build statement parts
      const parts = [adminName, formattedVerb];

      // Add subject/module if present
      if (subject) {
        parts.push(subject);
      } else if (module) {
        parts.push(module.toLowerCase());
      }

      // Add target
      if (formattedTarget) {
        parts.push(formattedTarget);
      }

      // Join and clean up
      let statement = parts.join(' ');

      // Capitalize first letter and ensure proper punctuation
      statement = statement.charAt(0).toUpperCase() + statement.slice(1);
      if (!statement.endsWith('.')) {
        statement += '.';
      }

      return statement;
    } catch (error) {
      // Fallback statement if anything fails
      console.error('Error generating log statement:', error);
      return `Admin action: ${action} on ${targetLabel || 'unknown target'}`;
    }
  }

  // get logs
  async getLogs(filter?: {
    module?: LogModule;
    adminId?: number;
    action?: string;
    search?: string;
    dateRange?: { from: Date; to: Date };
    page?: number;
    limit?: number;
    orderBy?: 'asc' | 'desc';
  }) {
    const page = filter?.page ?? 1;
    const limit = filter?.limit ?? 20;
    const skip = (page - 1) * limit;
    const orderDirection = filter?.orderBy ?? 'desc';

    // Validate module if provided
    if (filter?.module && !Object.values(LogModule).includes(filter.module)) {
      throw new BadRequestException('Invalid module specified');
    }

    // Build WHERE filter
    const where: Prisma.ActivityLogWhereInput = {};

    if (filter?.module) where.module = filter.module;
    if (filter?.adminId) where.adminId = filter.adminId;
    if (filter?.action) where.action = filter.action;

    if (filter?.dateRange) {
      where.createdAt = {
        gte: filter.dateRange.from,
        lte: filter.dateRange.to,
      };
    }

    // Optional search
    if (filter?.search) {
      const q = filter.search;
      where.OR = [
        { action: { contains: q, mode: 'insensitive' } },
        { targetLabel: { contains: q, mode: 'insensitive' } },
        { admin: { name: { contains: q, mode: 'insensitive' } } },
        { ipAddress: { contains: q } },
      ];
    }

    // Count total
    const total = await this.prisma.activityLog.count({ where });

    // Fetch data with pagination
    const logs = await this.prisma.activityLog.findMany({
      where,
      include: {
        admin: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: orderDirection },
      skip,
      take: limit,
    });

    const totalPages = Math.ceil(total / limit);

    return {
      logs,
      metadata: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  // batch logging
  async logMany(logs: Array<Parameters<ActivityLogService['log']>[0]>) {
    try {
      await this.prisma.activityLog.createMany({
        data: logs.map((log) => ({
          adminId: log.adminId,
          action: log.action,
          module: log.module,
          targetId: log.targetId ? String(log.targetId) : null,
          targetLabel: log.targetLabel,
          metadata: log.metadata,
          ipAddress: log.ipAddress,
          userAgent: log.userAgent,
        })),
      });
    } catch (err) {
      console.error('Batch ActivityLog failed:', err);
    }
  }

  // cleanup old logs
  async cleanupOldLogs(daysToKeep: number = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.prisma.activityLog.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
        // Keep important logs (you can add severity later)
      },
    });

  // console.log(`Cleaned up ${result.count} old activity logs`);
    return result;
  }
}
