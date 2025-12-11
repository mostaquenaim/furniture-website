/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { CreateFaqDto } from './dto/create-faq.dto';
import { UpdateFaqDto } from './dto/update-faq.dto';

@Injectable()
export class FaqService {
  private faqs = [];

  getAll() { return this.faqs; }

  create(dto: CreateFaqDto) {
    console.log('Create FAQ called with dto:', dto);
    // const faq = { id: Date.now(), ...dto };
    // this.faqs.push(faq);
    // return faq;
  }

  update(id: string, dto: UpdateFaqDto) {
    console.log(`Update FAQ called for id: ${id} with dto:`, dto);
    // const idx = this.faqs.findIndex(f => f.id == +id);
    // if (idx === -1) return null;
    // this.faqs[idx] = { ...this.faqs[idx], ...dto };
    // return this.faqs[idx];
  }

  delete(id: string) {
    console.log(`Delete FAQ called for id: ${id}`);
    // this.faqs = this.faqs.filter(f => f.id != +id);
    // return { message: 'FAQ deleted' };
  }
}
