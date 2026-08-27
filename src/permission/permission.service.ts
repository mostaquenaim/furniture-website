/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// src/permission/permission.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserRole } from '@prisma/client';
import { Action } from './action.enum';
import { ActivityLogService } from 'src/activity-log/activity-log.service';

@Injectable()
export class PermissionService {
  private readonly logger = new Logger(PermissionService.name);

  constructor(
    private prisma: PrismaService,
    private activityLogService: ActivityLogService,
  ) {}

  async onApplicationBootstrap() {
    await this.syncMissingPermissions();
  }

  async syncMissingPermissions() {
    const roles = Object.values(UserRole).filter(
      (r) => r !== UserRole.SUPERADMIN,
    );
    const actions = Object.values(Action);

    // One bulk insert instead of a findUnique+create round trip per
    // role/action pair (up to 850 sequential queries) — fine against a local
    // Postgres but slow, and fragile over a network connection to Neon.
    const { count } = await this.prisma.rolePermission.createMany({
      data: roles.flatMap((role) =>
        actions.map((action) => ({ role, action, enabled: false })),
      ),
      skipDuplicates: true,
    });

    if (count > 0) {
      this.logger.log(`Permission sync complete — ${count} new row(s) inserted.`);
    }
  }

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

  // Superadmin bulk-toggles (role, action) pairs — logs each actual change
  async bulkSetPermissions(
    changes: { action: string; role: UserRole; enabled: boolean }[],
    adminId: number,
  ) {
    const existing = await this.prisma.rolePermission.findMany({
      where: {
        OR: changes.map(({ role, action }) => ({
          role,
          action: action as Action,
        })),
      },
    });
    const existingMap = new Map(
      existing.map((p) => [`${p.role}_${p.action}`, p.enabled]),
    );

    const results = await Promise.all(
      changes.map(({ action, role, enabled }) =>
        this.setPermission(role, action as Action, enabled),
      ),
    );

    const actualChanges = changes.filter(
      ({ role, action, enabled }) =>
        (existingMap.get(`${role}_${action}`) ?? false) !== enabled,
    );

    if (actualChanges.length > 0) {
      await this.activityLogService.log({
        adminId,
        action: 'UPDATE_ROLE_PERMISSIONS',
        module: 'AUTH',
        targetLabel: `${actualChanges.length} permission(s)`,
        severity: 'WARNING',
        oldValue: actualChanges.map(({ role, action }) => ({
          role,
          action,
          enabled: existingMap.get(`${role}_${action}`) ?? false,
        })),
        newValue: actualChanges,
      });
    }

    return results;
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
