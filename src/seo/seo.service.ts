import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ActivityLogService } from 'src/activity-log/activity-log.service';
import { UpsertSeoDto } from './dto/upsert-seo.dto';

@Injectable()
export class SeoService {
  constructor(
    private prisma: PrismaService,
    private activityLogService: ActivityLogService,
  ) {}

  getAll() {
    return this.prisma.sEO.findMany({ orderBy: { url: 'asc' } });
  }

  getByUrl(url: string) {
    return this.prisma.sEO.findUnique({ where: { url } });
  }

  async upsert(dto: UpsertSeoDto, adminId: number) {
    const existing = await this.prisma.sEO.findUnique({
      where: { url: dto.url },
    });

    const data = {
      title: dto.title ?? null,
      description: dto.description ?? null,
      keywords: dto.keywords ?? null,
      canonical: dto.canonical ?? null,
      ogTitle: dto.ogTitle ?? null,
      ogDescription: dto.ogDescription ?? null,
      ogImage: dto.ogImage ?? null,
      noIndex: dto.noIndex ?? false,
      noFollow: dto.noFollow ?? false,
      updatedBy: adminId,
    };

    const entry = await this.prisma.sEO.upsert({
      where: { url: dto.url },
      update: data,
      create: { url: dto.url, ...data },
    });

    await this.activityLogService.log({
      adminId,
      action: existing ? 'UPDATE_SEO_META' : 'CREATE_SEO_META',
      module: 'CONTENT',
      targetId: entry.id,
      targetLabel: entry.url,
      oldValue: existing ?? undefined,
      newValue: entry,
    });

    return entry;
  }

  async remove(id: number, adminId: number) {
    const existing = await this.prisma.sEO.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`SEO entry ${id} not found`);

    await this.prisma.sEO.delete({ where: { id } });

    await this.activityLogService.log({
      adminId,
      action: 'DELETE_SEO_META',
      module: 'CONTENT',
      targetId: existing.id,
      targetLabel: existing.url,
      oldValue: existing,
    });
  }
}
