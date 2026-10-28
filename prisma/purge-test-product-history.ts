// One-off cleanup for TEST products only. Removes the history that blocks a
// product hard delete — orders, barcoded pieces and stock — so the product can
// then be deleted normally from the admin panel (which handles carts,
// wishlists, images, storefront cache and the activity log).
//
// An order is only removed if every line in it belongs to one of the given
// products. If an order also contains another product, that order is kept and
// every given product in it is skipped, so real orders are never touched.
//
// Dry run by default — prints what it would remove and changes nothing:
//   npx tsx prisma/purge-test-product-history.ts <slug> [<slug> ...]
// Apply (single transaction, all or nothing):
//   npx tsx prisma/purge-test-product-history.ts <slug> [<slug> ...] --apply
//
// Not part of the deploy pipeline; delete once the test data is gone.
import { PrismaClient } from '@prisma/client';
import { deleteOrdersTx } from './purge-helpers';

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const slugs = [...new Set(args.filter((a) => !a.startsWith('--')))];

async function main() {
  if (slugs.length === 0) {
    console.error(
      'Usage: npx tsx prisma/purge-test-product-history.ts <slug> [<slug> ...] [--apply]',
    );
    process.exit(1);
  }

  const dbHost = (process.env.DATABASE_URL ?? '').split('@')[1]?.split('/')[0];
  console.log(`[purge] database: ${dbHost ?? 'unknown'}`);
  console.log(`[purge] mode: ${apply ? 'APPLY' : 'dry run (add --apply to execute)'}\n`);

  const products = await prisma.product.findMany({
    where: { slug: { in: slugs } },
    select: { id: true, slug: true, title: true },
  });
  const missing = slugs.filter((s) => !products.some((p) => p.slug === s));
  if (missing.length > 0) {
    console.error(`[purge] not found: ${missing.join(', ')}`);
    process.exit(1);
  }

  const title = new Map(products.map((p) => [p.id, `${p.title} (${p.slug})`]));
  const targets = new Set(products.map((p) => p.id));
  const skipped = new Map<number, string[]>(); // productId -> blocking order codes

  // Shrink the target set until no remaining order mixes a target product
  // with anything else.
  let orders: { id: number; orderId: string; couponId: number | null }[] = [];
  for (;;) {
    const ids = [...targets];
    const touched = await prisma.order.findMany({
      where: {
        items: {
          some: {
            OR: [
              { productId: { in: ids } },
              { productSize: { color: { productId: { in: ids } } } },
            ],
          },
        },
      },
      select: {
        id: true,
        orderId: true,
        couponId: true,
        items: {
          select: {
            productId: true,
            productSize: { select: { color: { select: { productId: true } } } },
          },
        },
      },
    });

    let changed = false;
    for (const order of touched) {
      const lineProducts = order.items.flatMap((i) =>
        i.productSize ? [i.productId, i.productSize.color.productId] : [i.productId],
      );
      if (lineProducts.every((pid) => targets.has(pid))) continue;
      for (const pid of lineProducts) {
        if (!targets.has(pid)) continue;
        targets.delete(pid);
        skipped.set(pid, [...(skipped.get(pid) ?? []), order.orderId]);
        changed = true;
      }
    }

    if (!changed) {
      orders = touched.map(({ id, orderId, couponId }) => ({ id, orderId, couponId }));
      break;
    }
  }

  for (const [pid, codes] of skipped) {
    console.log(
      `[purge] SKIP ${title.get(pid)} — shares order(s) ${codes.join(', ')} with another product`,
    );
  }
  if (targets.size === 0) {
    console.log('\n[purge] nothing left to clean.');
    return;
  }

  const productIds = [...targets];
  const sizeIds = (
    await prisma.productSize.findMany({
      where: { color: { productId: { in: productIds } } },
      select: { id: true },
    })
  ).map((s) => s.id);
  const orderIds = orders.map((o) => o.id);

  const [orderItemIds, paymentIds, returnIds, shipmentIds, pieceIds] = await Promise.all([
    prisma.orderItem
      .findMany({ where: { orderId: { in: orderIds } }, select: { id: true } })
      .then((r) => r.map((x) => x.id)),
    prisma.payment
      .findMany({ where: { orderId: { in: orderIds } }, select: { id: true } })
      .then((r) => r.map((x) => x.id)),
    prisma.returnRequest
      .findMany({ where: { orderId: { in: orderIds } }, select: { id: true } })
      .then((r) => r.map((x) => x.id)),
    prisma.courierShipment
      .findMany({ where: { orderId: { in: orderIds } }, select: { id: true } })
      .then((r) => r.map((x) => x.id)),
    prisma.piece
      .findMany({ where: { productSizeId: { in: sizeIds } }, select: { id: true } })
      .then((r) => r.map((x) => x.id)),
  ]);

  const stock = await prisma.productSize.aggregate({
    where: { id: { in: sizeIds } },
    _sum: { quantity: true },
  });

  console.log('\n[purge] products to clear:');
  for (const pid of productIds) console.log(`  - ${title.get(pid)}`);
  console.log('\n[purge] will remove:');
  console.log(`  orders:            ${orders.length}${orders.length ? ` (${orders.map((o) => o.orderId).join(', ')})` : ''}`);
  console.log(`  order lines:       ${orderItemIds.length}`);
  console.log(`  payments:          ${paymentIds.length}`);
  console.log(`  return requests:   ${returnIds.length}`);
  console.log(`  courier shipments: ${shipmentIds.length}`);
  console.log(`  barcoded pieces:   ${pieceIds.length}`);
  console.log(`  and set ${stock._sum.quantity ?? 0} unit(s) of stock to 0`);

  if (!apply) {
    console.log('\n[purge] dry run — nothing changed. Re-run with --apply to execute.');
    return;
  }

  await prisma.$transaction(
    async (tx) => {
      await deleteOrdersTx(tx, orders, pieceIds);

      // Warehouse side
      await tx.pieceStatusEvent.deleteMany({ where: { pieceId: { in: pieceIds } } });
      await tx.piece.deleteMany({ where: { id: { in: pieceIds } } });
      await tx.generationBatch.deleteMany({ where: { productSizeId: { in: sizeIds } } });
      const stockWhere = {
        OR: [{ productId: { in: productIds } }, { productSizeId: { in: sizeIds } }],
      };
      await tx.inventoryItem.deleteMany({ where: stockWhere });
      await tx.stockAdjustment.deleteMany({ where: stockWhere });
      await tx.productSize.updateMany({
        where: { id: { in: sizeIds } },
        data: { quantity: 0, soldCount: 0 },
      });
      await tx.product.updateMany({
        where: { id: { in: productIds } },
        data: { soldCount: 0, totalProductQuantity: 0 },
      });
    },
    { timeout: 60_000 },
  );

  console.log('\n[purge] done. Now delete these products from the admin panel.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
