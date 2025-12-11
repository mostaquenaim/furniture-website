/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Injectable } from '@nestjs/common';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';

@Injectable()
export class CouponsService {
  private coupons = [];

  getAll() {
    return this.coupons;
  }

  create(dto: CreateCouponDto) {
    console.log(dto);
    // const coupon = {
    //   id: Date.now(),
    //   used: 0,
    //   ...dto,
    // };
    // this.coupons.push(coupon);
    // return coupon;
  }

  getAvailableForUser() {
    // const now = new Date();
    // return this.coupons.filter(c => {
    //   const from = c.validFrom ? new Date(c.validFrom) <= now : true;
    //   const to = c.validTo ? new Date(c.validTo) >= now : true;
    //   return from && to;
    // });
  }

  getByCode(code: string) {
    console.log(code);
    // return this.coupons.find(c => c.code === code);
  }

  update(id: any, dto: UpdateCouponDto) {
    console.log(id, dto);
    // const idx = this.coupons.findIndex(c => c.id == id);
    // if (idx === -1) return null;

    // this.coupons[idx] = { ...this.coupons[idx], ...dto };
    // return this.coupons[idx];
  }

  delete(id: any) {
    console.log(id);
    // this.coupons = this.coupons.filter(c => c.id != id);
    // return { message: 'Coupon deleted' };
  }

  validate(id: any) {
    console.log(id);
    // const coupon = this.coupons.find(c => c.id == id);
    // if (!coupon) return { valid: false };

    // return { valid: true, coupon };
  }
}
