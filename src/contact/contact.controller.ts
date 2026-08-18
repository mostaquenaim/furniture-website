import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { ContactService } from './contact.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { Permission } from 'src/permission/permission.decorator';
import { Action } from 'src/permission/action.enum';

@Controller('contact')
export class ContactController {
  constructor(private readonly service: ContactService) {}

  @Post() submit(@Body() dto: CreateContactDto) {
    return this.service.submit(dto);
  }

  @Get('submissions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permission(Action.CMS_VIEW)
  getAll() {
    return this.service.getAll();
  }
}
