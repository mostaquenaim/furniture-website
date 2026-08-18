// One-off, additive-only fix for the INVENTORYMANAGER / PRODUCTMANAGER /
// ORDERMANAGER permission gaps caused by the stale seed.ts Action enum
// (see prisma/seed.ts for the corresponding fixed defaults). Only ever
// flips the exact (role, action) pairs listed below to enabled:true —
// never touches any other row, never sets anything to false. Safe to
// re-run any number of times. Not part of the deploy pipeline; run
// manually once per environment that needs it, then it can be deleted.
import { PrismaClient, UserRole } from '@prisma/client';
import { Action } from '../src/permission/action.enum';

const prisma = new PrismaClient();

const GRANTS: Partial<Record<UserRole, Action[]>> = {
  [UserRole.PRODUCTMANAGER]: [
    Action.PIECE_VIEW,
    Action.PIECE_GENERATE,
    Action.PIECE_VOID,
    Action.SUPPLIER_VIEW,
    Action.SUPPLIER_MANAGE,
    Action.INVENTORY_VIEW,
  ],
  [UserRole.ORDERMANAGER]: [
    Action.RESERVATION_MANAGE,
    Action.PICK_SLIP_VIEW,
    Action.RESERVATION_PICK_CONFIRM,
  ],
  [UserRole.INVENTORYMANAGER]: [
    Action.PIECE_VIEW,
    Action.PIECE_RECEIVE,
    Action.PIECE_LOCATION_ASSIGN,
    Action.RETURN_RECEIVE_SCAN,
    Action.SUPPLIER_VIEW,
    Action.DASHBOARD_SHELF_MAP_VIEW,
    Action.DASHBOARD_DAMAGE_REPORT_VIEW,
  ],
};

async function main() {
  let totalMatched = 0;

  for (const [role, actions] of Object.entries(GRANTS) as [
    UserRole,
    Action[],
  ][]) {
    const result = await prisma.rolePermission.updateMany({
      where: { role, action: { in: actions } },
      data: { enabled: true },
    });
    console.log(
      `[backfill] ${role}: matched ${result.count} row(s) of ${actions.length} target action(s)`,
    );
    totalMatched += result.count;
  }

  console.log(`[backfill] done — ${totalMatched} row(s) set to enabled:true total.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
