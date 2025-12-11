/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { UpdateStockDto } from './dto/update-stock.dto';
import { AlertStockDto } from './dto/alert-stock.dto';

@Injectable()
export class InventoryService {
  private inventory = []; // Mock products with stock
  private lowStockThreshold = 5;

  // Get inventory
  getInventory() {
    return this.inventory;
  }

  // Bulk update stock
  updateStock(dto: UpdateStockDto) {
    console.log(dto);
    // dto.items.forEach(item => {
    //   const idx = this.inventory.findIndex(p => p.productId == item.productId && p.variantId == item.variantId);
    //   if (idx > -1) {
    //     this.inventory[idx].stock = item.stock;
    //   } else {
    //     this.inventory.push({ ...item });
    //   }
    // });
    // return { message: 'Inventory updated', inventory: this.inventory };
  }

  // Set low stock threshold
  setLowStockAlert(dto: AlertStockDto) {
    this.lowStockThreshold = dto.threshold;
    return { message: `Low stock threshold set to ${dto.threshold}` };
  }

  // Export inventory (mock)
  exportInventory() {
    // return this.inventory.map(p => ({
    //   productId: p.productId,
    //   variantId: p.variantId,
    //   stock: p.stock,
    // }));
  }
}
