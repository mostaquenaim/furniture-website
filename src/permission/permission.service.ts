/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// src/permission/permission.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserRole } from '@prisma/client';
import { Action } from './action.enum';

@Injectable()
export class PermissionService {
  constructor(private prisma: PrismaService) {}

  // Core guard check
  async isAllowed(role: UserRole, action: string): Promise<boolean> {
    const perm = await this.prisma.rolePermission.findUnique({
      where: { role_action: { role, action } },
    });
    return perm?.enabled ?? false;
  }

  // Returns all (role, action, enabled) rows — for the superadmin UI
  getAllPermissions() {
    return this.prisma.rolePermission.findMany({
      orderBy: [{ role: 'asc' }, { action: 'asc' }],
    });
  }

  // Superadmin toggles a single (role, action) pair
  setPermission(role: UserRole, action: Action, enabled: boolean) {
    return this.prisma.rolePermission.upsert({
      where: { role_action: { role, action } },
      update: { enabled },
      create: { role, action, enabled },
    });
  }

  // Returns allowed actions for a role — used by Next.js frontend
  async getActionsForRole(role: UserRole): Promise<string[]> {
    if (role === UserRole.SUPERADMIN) {
      return Object.values(Action); // superadmin gets everything
    }

    const rows = await this.prisma.rolePermission.findMany({
      where: { role, enabled: true },
    });
    return rows.map((r) => r.action);
  }
}
