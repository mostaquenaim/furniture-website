/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-return */
// src/company/company.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateCompanyDto } from './dto/update-company.dto';

const SINGLETON_ID = 1;

@Injectable()
export class CompanyService {
  constructor(private prisma: PrismaService) {}

  async get() {
    return this.prisma.companyInfo.upsert({
      where: { id: SINGLETON_ID },
      update: {},
      create: { id: SINGLETON_ID, name: 'Sakigai' },
    });
  }

  async update(dto: UpdateCompanyDto, adminId: number) {
    return this.prisma.companyInfo.upsert({
      where: { id: SINGLETON_ID },
      update: { ...dto, updatedBy: adminId },
      create: { id: SINGLETON_ID, name: 'Sakigai', ...dto, updatedBy: adminId },
    });
  }
}
