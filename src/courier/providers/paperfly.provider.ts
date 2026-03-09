/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
// src/courier/providers/paperfly.provider.ts
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { Injectable, Logger } from '@nestjs/common';
import { CourierProviderInterface } from './courier-provider.interface';

@Injectable()
export class PaperflyProvider implements CourierProviderInterface {
  private readonly logger = new Logger(PaperflyProvider.name);
  private baseUrl?: string;
  private apiKey?: string;
  private secretKey?: string;

  constructor(
    private httpService: HttpService,
    private configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get(
      'PAPERFLY_API_URL',
      'https://portal.paperfly.com.bd/api/v1',
    );
    this.apiKey = this.configService.get('PAPERFLY_API_KEY');
    this.secretKey = this.configService.get('PAPERFLY_SECRET_KEY');
  }

  async createShipment(data: any): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/create_order`,
          {
            invoice: data.orderId,
            recipient_name: data.customerName,
            recipient_phone: data.customerPhone,
            recipient_address: data.customerAddress,
            cod_amount: data.codAmount,
            note: `Order items: ${data.items.map((i: any) => i.name).join(', ')}`,
          },
          {
            headers: {
              'Api-Key': this.apiKey,
              'Secret-Key': this.secretKey,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      return {
        consignmentId: response.data.consignment_id,
        trackingNumber: response.data.tracking_code,
        trackingUrl: `https://paperfly.com.bd/t/${response.data.tracking_code}`,
        status: response.data.status,
        labelUrl: response.data.label_url,
        deliveryCharge: response.data.delivery_charge,
        metadata: response.data,
      };
    } catch (error) {
      this.logger.error(
        'Paperfly API error:',
        error.response?.data || error.message,
      );
      throw new Error(
        `Paperfly: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  async trackShipment(trackingId: string): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/status/${trackingId}`, {
          headers: {
            'Api-Key': this.apiKey,
            'Secret-Key': this.secretKey,
          },
        }),
      );

      return {
        status: this.mapStatus(response.data.delivery_status),
        providerStatus: response.data.delivery_status,
        trackingNumber: trackingId,
        estimatedDelivery: response.data.estimated_delivery,
        currentLocation: response.data.current_location,
        metadata: response.data,
      };
    } catch (error) {
      this.logger.error('Paperfly tracking error:', error);
      throw new Error(`Failed to track shipment: ${error.message}`);
    }
  }

  async cancelShipment(shipmentId: string): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/cancel/${shipmentId}`,
          {},
          {
            headers: {
              'Api-Key': this.apiKey,
              'Secret-Key': this.secretKey,
            },
          },
        ),
      );

      return {
        success: response.data.status === 200,
        message: response.data.message,
      };
    } catch (error) {
      this.logger.error('Paperfly cancel error:', error);
      throw new Error(`Failed to cancel shipment: ${error.message}`);
    }
  }

  calculateRate(data: any): any {
    // Paperfly might have a rate calculation endpoint
    return {
      deliveryCharge: 120, // Default rate
      codFee: data.codAmount ? data.codAmount * 0.01 : 0, // 1% COD fee
    };
  }

  private mapStatus(status: string): string {
    const map: Record<string, string> = {
      pending: 'PENDING',
      delivered: 'DELIVERED',
      cancelled: 'CANCELLED',
      return: 'RETURNED',
      in_review: 'ON_HOLD',
      transit: 'IN_TRANSIT',
    };
    return map[status?.toLowerCase()] || 'PENDING';
  }
}
