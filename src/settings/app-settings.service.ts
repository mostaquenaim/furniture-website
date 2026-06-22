import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

const SINGLETON_ID = 1;

// Persisted, admin-editable global defaults — currently just the fallback
// delivery fee used when a new district is created without one.
@Injectable()
export class AppSettingsService {
  constructor(private prisma: PrismaService) {}

  get() {
    return this.prisma.appSettings.upsert({
      where: { id: SINGLETON_ID },
      update: {},
      create: { id: SINGLETON_ID },
    });
  }

  async getDefaultDeliveryFee(): Promise<number> {
    const settings = await this.get();
    return settings.defaultDeliveryFee;
  }

  async updateDefaultDeliveryFee(fee: number) {
    if (typeof fee !== 'number' || Number.isNaN(fee) || fee < 0) {
      throw new BadRequestException(
        'defaultDeliveryFee must be a non-negative number',
      );
    }

    return this.prisma.appSettings.upsert({
      where: { id: SINGLETON_ID },
      update: { defaultDeliveryFee: fee },
      create: { id: SINGLETON_ID, defaultDeliveryFee: fee },
    });
  }
}
