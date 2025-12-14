/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Injectable } from '@nestjs/common';
import { UserRole } from 'src/generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';


@Injectable()
export class PermissionService {
  constructor(private prisma: PrismaService) {}

async getRolesForRoute(route: string): Promise<UserRole[]> {
    const permission = await this.prisma.permission.findUnique({
      where: { route },
      select: { roles: true },
    });
    return permission?.roles || [];
  }
  

}
