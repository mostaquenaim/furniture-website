import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { ActivityLogService } from 'src/activity-log/activity-log.service';

const SINGLETON_ID = 1;
const DEFAULT_COMPANY_NAME = process.env.COMPANY_NAME || 'Ondorkotha';

@Injectable()
export class CompanyService {
  constructor(
    private prisma: PrismaService,
    private activityLogService: ActivityLogService,
  ) {}

  async get() {
    return this.prisma.companyInfo.upsert({
      where: { id: SINGLETON_ID },
      update: {},
      create: { id: SINGLETON_ID, name: DEFAULT_COMPANY_NAME },
    });
  }

  async update(dto: UpdateCompanyDto, adminId: number) {
    const before = await this.get();

    const updated = await this.prisma.companyInfo.upsert({
      where: { id: SINGLETON_ID },
      update: { ...dto, updatedBy: adminId },
      create: {
        id: SINGLETON_ID,
        name: DEFAULT_COMPANY_NAME,
        ...dto,
        updatedBy: adminId,
      },
    });

    await this.activityLogService.log({
      adminId,
      action: 'UPDATE_COMPANY_INFO',
      module: 'SYSTEM',
      targetLabel: 'Company info',
      oldValue: before,
      newValue: updated,
    });

    return updated;
  }
}
