/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Injectable } from '@nestjs/common';

@Injectable()
export class FlashSalesService {
  private flashSales = [];

  getActive() {
    // const now = new Date();
    // return this.flashSales.filter(f =>
    //   new Date(f.startsAt) <= now && new Date(f.endsAt) >= now,
    // );
  }

  create(dto: any) {
    console.log(dto);
    // const fs = { id: Date.now(), ...dto };
    // this.flashSales.push(fs);
    // return fs;
  }

  getById(id: string) {
    console.log(id);
    // return this.flashSales.find(f => f.id == id);
  }

  update(id: string, dto: any) {
    console.log(id, dto);
    // const idx = this.flashSales.findIndex(f => f.id == id);
    // if (idx === -1) return null;

    // this.flashSales[idx] = { ...this.flashSales[idx], ...dto };
    // return this.flashSales[idx];
  }

  delete(id: string) {
    console.log(id);
    // this.flashSales = this.flashSales.filter(f => f.id != id);
    // return { message: 'Flash sale deleted' };
  }

  getProducts(id: string) {
    console.log(id);
    // const fs = this.flashSales.find(f => f.id == id);
    // return fs?.products || [];
  }
}
