// Shared by the one-off purge scripts in this folder. Deletes orders and
// everything hanging off them, children first. Call inside a transaction.
import { Prisma } from '@prisma/client';

export async function deleteOrdersTx(
  tx: Prisma.TransactionClient,
  orders: { id: number; couponId: number | null }[],
  extraPieceIds: number[] = [],
) {
  const orderIds = orders.map((o) => o.id);
  const ids = (rows: { id: number }[]) => rows.map((r) => r.id);
  const inOrders = { where: { orderId: { in: orderIds } }, select: { id: true } };

  const orderItemIds = ids(await tx.orderItem.findMany(inOrders));
  const paymentIds = ids(await tx.payment.findMany(inOrders));
  const returnIds = ids(await tx.returnRequest.findMany(inOrders));
  const shipmentIds = ids(await tx.courierShipment.findMany(inOrders));

  await tx.orderLineReservation.deleteMany({
    where: {
      OR: [
        { orderItemId: { in: orderItemIds } },
        { pieceId: { in: extraPieceIds } },
        { shipmentGroup: { orderId: { in: orderIds } } },
      ],
    },
  });
  await tx.shipmentGroup.deleteMany({ where: { orderId: { in: orderIds } } });
  await tx.courierWebhookLog.deleteMany({ where: { shipmentId: { in: shipmentIds } } });
  await tx.courierShipment.deleteMany({ where: { id: { in: shipmentIds } } });
  await tx.paymentRefund.deleteMany({
    where: {
      OR: [{ paymentId: { in: paymentIds } }, { returnRequestId: { in: returnIds } }],
    },
  });
  await tx.paymentLog.deleteMany({ where: { paymentId: { in: paymentIds } } });
  await tx.payment.deleteMany({ where: { id: { in: paymentIds } } });
  await tx.returnRequestItem.deleteMany({ where: { orderItemId: { in: orderItemIds } } });
  await tx.returnRequest.deleteMany({ where: { id: { in: returnIds } } });
  await tx.review.deleteMany({ where: { orderItemId: { in: orderItemIds } } });
  await tx.invoice.deleteMany({ where: { orderId: { in: orderIds } } });
  await tx.orderStatusHistory.deleteMany({ where: { orderId: { in: orderIds } } });
  await tx.orderItem.deleteMany({ where: { id: { in: orderItemIds } } });
  await tx.order.deleteMany({ where: { id: { in: orderIds } } });

  // Give back coupon uses consumed by the removed orders
  for (const { couponId } of orders) {
    if (couponId === null) continue;
    await tx.coupon.updateMany({
      where: { id: couponId, usedCount: { gt: 0 } },
      data: { usedCount: { decrement: 1 } },
    });
  }
}
