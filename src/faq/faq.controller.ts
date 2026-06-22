import { Controller, Get } from '@nestjs/common';
import { FaqService } from './faq.service';

@Controller('faq')
export class FaqController {
  constructor(private readonly service: FaqService) {}

  @Get()
  getAll() {
    return this.service.getAll();
  }
}
