import { Controller, Post, Get, Body } from '@nestjs/common';
import { ContactService } from './contact.service';
import { CreateContactDto } from './dto/create-contact.dto';

@Controller('contact')
export class ContactController {
  constructor(private readonly service: ContactService) {}

  @Post() submit(@Body() dto: CreateContactDto) { return this.service.submit(dto); }

  @Get('submissions') getAll() { return this.service.getAll(); }
}
