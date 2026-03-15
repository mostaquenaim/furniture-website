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
import axios from 'axios';
import { CourierStatus } from '@prisma/client';

@Injectable()
export class PaperflyProvider implements CourierProviderInterface {
  private readonly logger = new Logger(PaperflyProvider.name);
  private accessToken: string;
  private tokenExpiry: number;
  private clientId?: string;
  private clientSecret?: string;
  private username?: string;
  private password?: string;

  private baseUrl?: string;

  constructor(
    private httpService: HttpService,
    private configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get(
      'PAPERFLY_API_URL',
      'https://api-hermes.paperfly.com',
    );
    this.clientId = this.configService.get('PAPERFLY_CLIENT_ID');
    this.clientSecret = this.configService.get('PAPERFLY_CLIENT_SECRET');
    this.username = this.configService.get('PAPERFLY_USERNAME');
    this.password = this.configService.get('PAPERFLY_PASSWORD');
  }

  refreshToken() {
    throw new Error('Method not implemented.');
  }

  private async getPaperflyAccessToken(): Promise<string> {
    const now = Date.now();

    if (this.accessToken && this.tokenExpiry && now < this.tokenExpiry) {
      return this.accessToken;
    }

    const data = {
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: 'password',
      username: this.username,
      password: this.password,
    };

    try {
      const res = await axios.post(
        `${this.baseUrl}/aladdin/api/v1/issue-token`,
        data,
        {
          headers: { 'Content-Type': 'application/json' },
        },
      );

      this.accessToken = res.data.access_token;
      this.tokenExpiry = now + res.data.expires_in * 1000;

      this.logger.debug('Paperfly access token refreshed successfully');

      return this.accessToken;
    } catch (err) {
      this.logger.error('Token Error:', err.response?.data || err.message);
      throw new Error(
        `Failed to get Paperfly access token: ${err.response?.data?.message || err.message}`,
      );
    }
  }

  // provider.ts
  async createShipment(data: any): Promise<any> {
    try {
      const token = await this.getPaperflyAccessToken();

      // Validate required fields
      if (!data.store_id) {
        throw new Error('store_id is required for Paperfly shipment');
      }

      // console.log('shipment data', data, 'shipment data');

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/aladdin/api/v1/orders`,
          {
            store_id: parseInt(data.store_id), // Paperfly expects number
            merchant_order_id: data.merchant_order_id || data.orderId,
            recipient_name: data.recipient_name || data.customerName,
            recipient_phone: data.recipient_phone || data.customerPhone,
            recipient_address: data.recipient_address || data.shippingAddress,
            delivery_type: data.delivery_type || 48, // 48 = standard delivery
            item_type: data.item_type || 2, // 2 = document, 1 = parcel
            special_instruction: data.special_instruction || '',
            item_quantity: data.item_quantity || data.totalQuantity || 1,
            item_weight: data.item_weight || data.weight || '0.5',
            item_description:
              data.item_description || data.description || 'Items',
            amount_to_collect: data.amount_to_collect || data.codAmount || 0,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`, // Paperfly uses Bearer token
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      const result = response.data?.data;

      return {
        consignmentId: result.consignment_id,
        merchantOrderId: result.merchant_order_id,
        status: result.order_status,
        deliveryFee: result.delivery_fee,
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
          // headers: {
          //   'Api-Key': this.apiKey,
          //   'Secret-Key': this.secretKey,
          // },
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
            // headers: {
            //   'Api-Key': this.apiKey,
            //   'Secret-Key': this.secretKey,
            // },
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

  mapStatus(status: string): CourierStatus {
    const map: Record<string, CourierStatus> = {
      pending: CourierStatus.PENDING,
      delivered: CourierStatus.DELIVERED,
      cancelled: CourierStatus.CANCELLED,
      return: CourierStatus.RETURNED,
      in_review: CourierStatus.ON_HOLD,
      transit: CourierStatus.IN_TRANSIT,
    };

    return map[status?.toLowerCase()] || CourierStatus.PENDING;
  }
}
