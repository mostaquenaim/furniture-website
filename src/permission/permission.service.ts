/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class PermissionService {
  constructor(private prisma: PrismaService) {}

  async getRolesForRoute(
    endpoint: string,
    method: string,
  ): Promise<UserRole[]> {
    const permission = await this.prisma.backendPermission.findUnique({
      where: {
        endpoint_method: {
          endpoint,
          method,
        },
      },
      select: { roles: true },
    });

    return permission?.roles || [];
  }

  async getRolesAgainstURL(path: string): Promise<UserRole[]> {
    const permission = await this.prisma.frontendPermission.findUnique({
      where: { path },
      select: { roles: true },
    });
    return permission?.roles || [];
  }
}
