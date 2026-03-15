import { CourierStatus, OrderStatus } from '@prisma/client';

export const COURIER_TO_ORDER_STATUS: Partial<
  Record<CourierStatus, OrderStatus>
> = {
  // Booking/Pickup phase
  BOOKED: 'CONFIRMED',
  PICKUP_ASSIGNED: 'CONFIRMED',
  PICKED_UP: 'PROCESSING', // Changed from 'PACKED' to 'PROCESSING' for better flow

  // Transit phase
  IN_TRANSIT: 'SHIPPED',
  OUT_FOR_DELIVERY: 'SHIPPED',

  // Delivery outcomes
  DELIVERED: 'DELIVERED',
  PARTIALLY_DELIVERED: 'DELIVERED', // Order is still considered delivered if partially delivered

  // Failure cases
  FAILED: 'FAILED', // Added - maps to FAILED order status
  CANCELLED: 'CANCELLED',

  // Return flow
  RETURNED: 'RETURNED',

  // Hold cases
  ON_HOLD: 'PROCESSING', // Maps to PROCESSING as it's not a terminal state

  // Default for any unmapped statuses
  PENDING: 'PENDING',
};

// Optional: Add a helper function to check if a status is terminal
export const TERMINAL_COURIER_STATUSES: CourierStatus[] = [
  'DELIVERED',
  'PARTIALLY_DELIVERED',
  'FAILED',
  'CANCELLED',
  'RETURNED',
];

// Optional: Add status groups for better organization
export const COURIER_STATUS_GROUPS = {
  ACTIVE: [
    'BOOKED',
    'PICKUP_ASSIGNED',
    'PICKED_UP',
    'IN_TRANSIT',
    'OUT_FOR_DELIVERY',
    'ON_HOLD',
  ],
  TERMINAL: [
    'DELIVERED',
    'PARTIALLY_DELIVERED',
    'FAILED',
    'CANCELLED',
    'RETURNED',
  ],
} as const;
