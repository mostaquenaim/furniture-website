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
}
