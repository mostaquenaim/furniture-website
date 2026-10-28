import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ContactService } from './contact.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactMessageDto } from './dto/update-contact-message.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { Permission } from 'src/permission/permission.decorator';
import { Action } from 'src/permission/action.enum';

// Contact messages are support work, so staff access reuses the ticket grants
@Controller('contact')
export class ContactController {
  constructor(private readonly service: ContactService) {}

  @Post()
  submit(@Body() dto: CreateContactDto) {
    return this.service.submit(dto);
  }

  @Get('messages')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permission(Action.TICKET_VIEW)
  list(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('status') status?: string,
  ) {
    return this.service.list({
      page: Math.max(1, Number(page) || 1),
      limit: Math.min(100, Math.max(1, Number(limit) || 20)),
      status: status === 'open' || status === 'handled' ? status : undefined,
    });
  }

  @Patch('messages/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permission(Action.TICKET_MANAGE)
  setHandled(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateContactMessageDto,
  ) {
    return this.service.setHandled(id, dto.handled);
  }
}
