import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { Permission } from 'src/permission/permission.decorator';
import { Action } from 'src/permission/action.enum';
import { ApiClientService } from './api-client.service';
import { CreateApiClientDto } from './dto/create-api-client.dto';

interface AuthenticatedRequest extends Request {
  user: { userId: number };
}

// Admin-only management of 3rd-party API credentials. Same auth stack as
// every other admin route (JWT + role/permission) — a partner's API key is
// a separate concern from this controller's own auth, which is why this
// lives next to ApiClientService rather than under PartnerInventoryModule.
@Controller('api-clients')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ApiClientController {
  constructor(private readonly apiClientService: ApiClientService) {}

  @Post()
  @Permission(Action.API_CLIENT_MANAGE)
  create(@Body() dto: CreateApiClientDto, @Req() req: AuthenticatedRequest) {
    return this.apiClientService.create(dto, req.user.userId);
  }

  @Get()
  @Permission(Action.API_CLIENT_MANAGE)
  list() {
    return this.apiClientService.list();
  }

  @Post(':id/revoke')
  @HttpCode(HttpStatus.OK)
  @Permission(Action.API_CLIENT_MANAGE)
  revoke(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.apiClientService.revoke(id, req.user.userId);
  }
}
