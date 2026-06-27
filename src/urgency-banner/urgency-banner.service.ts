/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { CreateUrgencyBannerDto } from './dto/create-urgency-banner.dto';
import { UpdateUrgencyBannerDto } from './dto/update-urgency-banner.dto';

@Injectable()
export class UrgencyBannerService {
  private readonly logger = new Logger(UrgencyBannerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
  ) {}

  /**
   * Public: returns the single banner whose date window includes right now.
   * Returns null automatically once endDate passes — no manual action needed.
   */
  findActive() {
    const now = new Date();
    return this.prisma.urgencyBanner.findFirst({
      where: {
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
      },
      orderBy: { startDate: 'desc' },
    });
  }

  /** Admin: all banners regardless of date or active state */
  findAll() {
    return this.prisma.urgencyBanner.findMany({
      orderBy: { startDate: 'desc' },
    });
  }

  async create(dto: CreateUrgencyBannerDto, adminId: number) {
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);

    if (end <= start) {
      throw new BadRequestException('endDate must be after startDate');
    }

    try {
      const banner = await this.prisma.urgencyBanner.create({
        data: {
          message: dto.message,
          eventType: dto.eventType ?? null,
          link: dto.link ?? null,
          startDate: start,
          endDate: end,
          isActive: dto.isActive ?? true,
        },
      });

      this.activityLog.log({
        adminId,
        action: 'CREATE_URGENCY_BANNER',
        module: 'MARKETING',
        targetId: banner.id,
        targetLabel: banner.message,
        newValue: banner,
      });

      return banner;
    } catch (error) {
      this.logger.error(`Failed to create urgency banner: ${error.message}`);
      throw new InternalServerErrorException('Could not create urgency banner');
    }
  }

  async update(id: number, dto: UpdateUrgencyBannerDto, adminId: number) {
    const existing = await this.prisma.urgencyBanner.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException(`Urgency banner ${id} not found`);

    const start = dto.startDate ? new Date(dto.startDate) : existing.startDate;
    const end = dto.endDate ? new Date(dto.endDate) : existing.endDate;

    if (end <= start) {
      throw new BadRequestException('endDate must be after startDate');
    }

    try {
      const updated = await this.prisma.urgencyBanner.update({
        where: { id },
        data: {
          ...(dto.message !== undefined && { message: dto.message }),
          ...(dto.eventType !== undefined && { eventType: dto.eventType }),
          ...(dto.link !== undefined && { link: dto.link }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          startDate: start,
          endDate: end,
        },
      });

      this.activityLog.log({
        adminId,
        action: 'UPDATE_URGENCY_BANNER',
        module: 'MARKETING',
        targetId: id,
        targetLabel: updated.message,
        oldValue: existing,
        newValue: updated,
      });

      return updated;
    } catch (error) {
      this.logger.error(`Failed to update urgency banner ${id}: ${error.message}`);
      throw new InternalServerErrorException('Could not update urgency banner');
    }
  }

  async remove(id: number, adminId: number) {
    const existing = await this.prisma.urgencyBanner.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException(`Urgency banner ${id} not found`);

    await this.prisma.urgencyBanner.delete({ where: { id } });

    this.activityLog.log({
      adminId,
      action: 'DELETE_URGENCY_BANNER',
      module: 'MARKETING',
      targetId: id,
      targetLabel: existing.message,
      oldValue: existing,
    });
  }
}
