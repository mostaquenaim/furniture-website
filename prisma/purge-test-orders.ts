// One-off cleanup for TEST orders, picked by customer name or phone. Deletes
// each matching order and everything hanging off it (payments, refunds,
// invoice, shipments, returns, reviews, reservations).
//
// Dry run by default — lists the matches and changes nothing:
//   npx tsx prisma/purge-test-orders.ts
// Apply (single transaction, all or nothing):
//   npx tsx prisma/purge-test-orders.ts --apply
//
// Not part of the deploy pipeline; delete once the test data is gone.
import { PrismaClient } from '@prisma/client';
import { deleteOrdersTx } from './purge-helpers';

const NAME_CONTAINS = ['Mostaque'];
// Matched on the last 10 digits so +8801..., 8801... and 01... all hit.
const PHONES = ['+8801987654321', '+8801758550331'];

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');

async function main() {
  const dbHost = (process.env.DATABASE_URL ?? '').split('@')[1]?.split('/')[0];
  console.log(`[purge] database: ${dbHost ?? 'unknown'}`);
  console.log(`[purge] mode: ${apply ? 'APPLY' : 'dry run (add --apply to execute)'}\n`);

  const orders = await prisma.order.findMany({
    where: {
      OR: [
        ...NAME_CONTAINS.map((n) => ({
          customerName: { contains: n, mode: 'insensitive' as const },
        })),
        ...PHONES.map((p) => ({ customerPhone: { contains: p.slice(-10) } })),
      ],
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      orderId: true,
      couponId: true,
      customerName: true,
      customerPhone: true,
      status: true,
      total: true,
      createdAt: true,
      stockRestored: true,
      items: { select: { productTitle: true, quantity: true } },
      shipmentGroup: {
        select: { reservations: { select: { piece: { select: { status: true } } } } },
      },
    },
  });

  if (orders.length === 0) {
    console.log('[purge] no matching orders.');
    return;
  }

  for (const o of orders) {
    const items = o.items.map((i) => `${i.quantity}× ${i.productTitle}`).join(', ');
    console.log(
      `  ${o.orderId}  ${o.createdAt.toISOString().slice(0, 10)}  ${o.status.padEnd(16)} ` +
        `${String(o.total).padStart(8)}  ${o.customerName} / ${o.customerPhone}\n      ${items}`,
    );
  }

  const reservedPieces = orders.flatMap(
    (o) => o.shipmentGroup?.reservations.map((r) => r.piece.status) ?? [],
  );
  const notRestored = orders.filter((o) => !o.stockRestored).length;
  console.log(`\n[purge] ${orders.length} order(s) match.`);
  console.log(
    `[purge] ${notRestored} of them never had stock restored (deleting does not restore it).`,
  );
  if (reservedPieces.length > 0) {
    console.log(
      `[purge] ${reservedPieces.length} barcoded piece(s) are reserved to them; the pieces are kept, ` +
        `only the reservation link is removed. Statuses: ${[...new Set(reservedPieces)].join(', ')}`,
    );
  }

  if (!apply) {
    console.log('\n[purge] dry run — nothing changed. Re-run with --apply to execute.');
    return;
  }

  await prisma.$transaction((tx) => deleteOrdersTx(tx, orders), { timeout: 60_000 });
  console.log(`\n[purge] done — ${orders.length} order(s) deleted.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
