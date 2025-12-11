/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { UpdateDistrictDto } from './dto/update-district.dto';
import { CalculateShippingDto } from './dto/calculate-shipping.dto';
import { AwbDto } from './dto/awb.dto'; 
import { LabelDto } from './dto/label.dto';
import { TrackDto } from './dto/track.dto';

@Injectable()
export class ShippingService {
  private districts = [{ id: 1, name: 'Dhaka', charge: 50 }];

  getDistricts() { return this.districts; }

  updateDistrict(id: string, dto: UpdateDistrictDto) {
    const idx = this.districts.findIndex(d => d.id == +id);
    if (idx == -1) return null;
    this.districts[idx] = { ...this.districts[idx], ...dto };
    return this.districts[idx];
  }

  calculateShipping(dto: CalculateShippingDto) {
    const district = this.districts.find(d => d.name === dto.district);
    if (!district) return { cost: 0 };
    return { cost: district.charge * dto.weight };
  }

  codEligible(district: string) {
    const d = this.districts.find(d => d.name === district);
    return { eligible: !!d };
  }

  generateAwb(dto: AwbDto) { return { awbNumber: `AWB${Date.now()}`, orderId: dto.orderId }; }

  generateLabel(dto: LabelDto) { return { labelUrl: `https://label.mock/${dto.awbNumber}.pdf` }; }

  trackShipment(dto: TrackDto) {
    return { awbNumber: dto.awbNumber, status: 'In Transit', updatedAt: new Date() };
  }
}
