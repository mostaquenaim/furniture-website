import { CourierStatus } from '@prisma/client';

// src/courier/providers/courier-provider.interface.ts
export interface CourierProviderInterface {
  createShipment(data: any): Promise<any>;
  trackShipment(trackingId: string): Promise<any>;
  cancelShipment(shipmentId: string): Promise<any>;
  calculateRate(data: any): Promise<any>;
  mapStatus(providerStatus: string): CourierStatus;
  refreshToken();
}
