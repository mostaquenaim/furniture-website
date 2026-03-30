/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unused-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CourierProviderInterface } from '../providers/courier-provider.interface';
import { SteadfastProvider } from '../providers/steadfast.provider';
import { RedxProvider } from '../providers/redx.provider';
import { PaperflyProvider } from '../providers/paperfly.provider';
import { PathaoProvider } from '../providers/pathao.provider';
import { ActivityLogService } from 'src/activity-log/activity-log.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PathaoLocationSyncService {
  private providers: Map<string, CourierProviderInterface> = new Map();
  private readonly logger = new Logger(PathaoLocationSyncService.name);

  constructor(
    private prisma: PrismaService,
    private httpService: HttpService,
    private configService: ConfigService,
  ) {
    this.registerProviders();
  }

  private registerProviders() {
    // Register available courier providers
    this.providers.set(
      'steadfast',
      new SteadfastProvider(this.httpService, this.configService),
    );
    this.providers.set(
      'redx',
      new RedxProvider(this.httpService, this.configService),
    );
    this.providers.set(
      'paperfly',
      new PaperflyProvider(this.httpService, this.configService),
    );
    this.providers.set(
      'pathao',
      new PathaoProvider(this.httpService, this.configService),
    );
  }

  async syncCities() {
    // Get provider details
    const provider = await this.prisma.courierProvider.findUnique({
      where: { name: 'pathao' },
    });

    if (!provider || !provider.isActive) {
      // throw new BadRequestException('Courier provider not available');
      return false;
    }

    console.log(provider.name.toLowerCase(), 'provider-name');

    const providerImpl = this.providers.get(provider.name.toLowerCase());

    if (!providerImpl) {
      throw new BadRequestException(
        `Provider ${provider.name} implementation not found`,
      );
    }

    let cities;
    try {
      cities = await providerImpl.getCities();
      this.logger.log(
        `Fetched ${cities.length} cities from ${provider.name}, ${cities}`,
      );
    } catch (error) {
      this.logger.error(`Failed to fetch cities with ${provider.name}:`, error);

      return false;
    }

    for (const city of cities) {
      await this.prisma.city.upsert({
        where: { id: city.city_id },
        update: { name: city.city_name },
        create: {
          name: city.city_name,
          id: city.city_id,
        },
      });
    }
  }

  async syncZones() {
    // 1. Get Provider Implementation
    const provider = await this.prisma.courierProvider.findUnique({
      where: { name: 'pathao' },
    });

    if (!provider || !provider.isActive) return false;

    const providerImpl = this.providers.get(provider.name.toLowerCase());
    if (!providerImpl) {
      throw new BadRequestException(
        `Provider ${provider.name} implementation not found`,
      );
    }

    try {
      // 2. Fetch all cities first
      const cities = await providerImpl.getCities();
      this.logger.log(`Syncing zones for ${cities.length} cities...`);

      // 3. Loop through each city to get its specific zones
      for (const city of cities) {
        this.logger.log(
          `Fetching zones for city: ${city.city_name} (ID: ${city.city_id})`,
        );

        const zones = await providerImpl.getZones(city.city_id);

        if (zones && zones.length > 0) {
          // 4. Upsert zones into your database
          for (const zone of zones) {
            await this.prisma.zone.upsert({
              where: { pathaoZoneId: zone.zone_id },
              update: {
                name: zone.zone_name,
                cityId: city.city_id, // Ensure relationship is updated
              },
              create: {
                name: zone.zone_name,
                pathaoZoneId: zone.zone_id,
                cityId: city.city_id,
              },
            });
          }
        }

        // 5. CRITICAL: Rate limit protection
        // Wait 300-500ms before asking for the next city's zones
        await new Promise((resolve) => setTimeout(resolve, 400));
      }

      this.logger.log('Zone synchronization complete.');
      return true;
    } catch (error) {
      this.logger.error(`Failed to sync all zones:`, error.message);
      return false;
    }
  }

  async syncAreas(zoneId: number) {
    const provider = await this.prisma.courierProvider.findUnique({
      where: { name: 'pathao' },
    });

    if (!provider || !provider.isActive) {
      // throw new BadRequestException('Courier provider not available');
      return false;
    }

    const providerImpl = this.providers.get(provider.name.toLowerCase());
    if (!providerImpl) {
      throw new BadRequestException(
        `Provider ${provider.name} implementation not found`,
      );
    }

    let areas;
    try {
      areas = await providerImpl.getAreas(zoneId);
    } catch (error) {
      this.logger.error(`Failed to fetch areas with ${provider.name}:`, error);

      return false;
    }

    for (const area of areas) {
      await this.prisma.area.upsert({
        where: { pathaoAreaId: area.area_id },
        update: { name: area.area_name },
        create: {
          name: area.area_name,
          pathaoAreaId: area.area_id,
          zoneId: zoneId,
        },
      });
    }
  }
}
