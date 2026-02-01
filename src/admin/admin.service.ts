/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import districtsData from '../cms/data/districtData';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  // create district data
  async createDistrict() {
    for (const district of districtsData) {
      // Remove trailing spaces from names
      const cleanName = district.name.trim();

      // Check if district already exists
      const existingDistrict = await this.prisma.district.findUnique({
        where: { name: cleanName },
      });

      if (!existingDistrict) {
        await this.prisma.district.create({
          data: {
            name: cleanName,
          },
        });
        console.log(`Created district: ${cleanName}`);
      } else {
        console.log(`District already exists: ${cleanName}`);
      }
    }
  }
}
