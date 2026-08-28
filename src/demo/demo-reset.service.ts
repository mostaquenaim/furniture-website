import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { seedDemoData } from './demo-seed';

/**
 * Public Render demo only: wipes every application table and reseeds it on a
 * schedule, so anything an anonymous visitor uploads/edits through the demo
 * admin login (product/banner/blog images, arbitrary text, etc.) never sticks
 * around for long. Guarded on RENDER==='true' specifically (not the broader
 * demo-mode check used elsewhere) — a recurring wipe must never fire against
 * a developer's local database while they're working, or a real production
 * deploy, if one is ever pointed at NODE_ENV=production without RENDER set.
 */
@Injectable()
export class DemoResetService {
  private readonly logger = new Logger(DemoResetService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_6_HOURS, { name: 'demo-reset' })
  async handleScheduledReset() {
    if (process.env.RENDER !== 'true') return;

    try {
      await this.reset();
      this.logger.log('Demo data reset and reseeded');
    } catch (err) {
      this.logger.error('Demo reset run failed', err);
    }
  }

  async reset() {
    const tableNames = Prisma.dmmf.datamodel.models.map(
      (model) => model.dbName ?? model.name,
    );

    const quoted = tableNames.map((name) => `"${name}"`).join(', ');
    await this.prisma.$executeRawUnsafe(
      `TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE;`,
    );

    await seedDemoData(this.prisma);
  }
}
