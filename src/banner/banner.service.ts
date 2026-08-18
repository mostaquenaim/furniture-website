/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { CreateBroadBannerDto } from './dto/create-broad-banner.dto';
import { UpdateBroadBannerDto } from './dto/update-broad-banner.dto';
import { BroadBanner } from '@prisma/client';

@Injectable()
export class BroadBannerService {
  private readonly logger = new Logger(BroadBannerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
  ) {}

  async create(
    dto: CreateBroadBannerDto,
    adminId: number,
  ): Promise<BroadBanner> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (dto.isActive) {
          await tx.broadBanner.updateMany({
            where: { isActive: true },
            data: { isActive: false },
          });
        }

        const banner = await tx.broadBanner.create({ data: dto });

        await this.activityLog.log({
          adminId,
          action: 'CREATE_BROAD_BANNER',
          module: 'MARKETING',
          targetId: banner.id,
          targetLabel: banner.title,
          newValue: banner,
        });

        return banner;
      });
    } catch (error) {
      this.logger.error(`Failed to create banner: ${error.message}`);
      throw new InternalServerErrorException('Could not create banner');
    }
  }

  findAll(): Promise<BroadBanner[]> {
    return this.prisma.broadBanner.findMany({
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    });
  }

  findActive() {
    return this.prisma.broadBanner.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string): Promise<BroadBanner> {
    const banner = await this.prisma.broadBanner.findUnique({ where: { id } });
    if (!banner) throw new NotFoundException(`Banner with ID ${id} not found`);
    return banner;
  }

  async update(
    id: string,
    dto: UpdateBroadBannerDto,
    adminId: number,
  ): Promise<BroadBanner> {
    const existing = await this.findOne(id);

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (dto.isActive === true) {
          await tx.broadBanner.updateMany({
            where: { id: { not: id }, isActive: true },
            data: { isActive: false },
          });
        }

        const updated = await tx.broadBanner.update({
          where: { id },
          data: dto,
        });

        await this.activityLog.log({
          adminId,
          action: 'UPDATE_BROAD_BANNER',
          module: 'MARKETING',
          targetId: id,
          targetLabel: updated.title,
          oldValue: existing,
          newValue: updated,
        });

        return updated;
      });
    } catch (error: any) {
      this.logger.error(`Update failed for banner ${id}: ${error.message}`);
      throw new InternalServerErrorException('Could not update banner');
    }
  }

  async remove(id: string, adminId: number): Promise<void> {
    const banner = await this.findOne(id);

    await this.prisma.$transaction(async (tx) => {
      await tx.broadBanner.delete({ where: { id } });

      await this.activityLog.log({
        adminId,
        action: 'DELETE_BROAD_BANNER',
        module: 'MARKETING',
        targetId: id,
        targetLabel: banner.title,
        oldValue: banner,
      });
    });
  }
}
