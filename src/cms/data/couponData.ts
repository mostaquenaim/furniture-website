/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { CouponDiscountType } from '@prisma/client';

const couponsData = [
  {
    code: 'WELCOME10',
    discountType: CouponDiscountType.PERCENTAGE,
    discountValue: 10,
    minOrderValue: 1000,
    maxDiscount: 500,
    startDate: new Date(),
    expiryDate: new Date('2026-12-31'),
    isActive: true,
  },
  {
    code: 'FLAT300',
    discountType: CouponDiscountType.FIXED_AMOUNT,
    discountValue: 300,
    minOrderValue: 2000,
    maxDiscount: null,
    startDate: new Date(),
    expiryDate: new Date('2026-06-30'),
    isActive: true,
  },
  {
    code: 'FREESHIP',
    discountType: CouponDiscountType.FREE_DELIVERY,
    discountValue: null,
    minOrderValue: 1500,
    maxDiscount: null,
    startDate: new Date(),
    expiryDate: new Date('2026-03-31'),
    isActive: true,
  },
  {
    code: 'EID20',
    discountType: CouponDiscountType.PERCENTAGE,
    discountValue: 20,
    minOrderValue: 3000,
    maxDiscount: 1000,
    startDate: new Date('2026-03-20'),
    expiryDate: new Date('2026-04-15'),
    isActive: true,
  },
  {
    code: 'OLDSTOCK500',
    discountType: CouponDiscountType.FIXED_AMOUNT,
    discountValue: 500,
    minOrderValue: 5000,
    maxDiscount: null,
    startDate: new Date(),
    expiryDate: new Date('2026-02-15'),
    isActive: false, // expired / disabled coupon
  },
];

export default couponsData;
