import { CourierStatus, OrderStatus } from '@prisma/client';

export const COURIER_TO_ORDER_STATUS: Partial<
  Record<CourierStatus, OrderStatus>
> = {
  BOOKED: 'CONFIRMED',
  PICKUP_ASSIGNED: 'CONFIRMED',
  PICKED_UP: 'PACKED',
  IN_TRANSIT: 'SHIPPED',
  OUT_FOR_DELIVERY: 'SHIPPED',
  DELIVERED: 'DELIVERED',
  PARTIALLY_DELIVERED: 'DELIVERED',
  RETURNED: 'RETURNED',
  CANCELLED: 'CANCELLED',
};
