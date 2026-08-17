/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
// src/courier/courier.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CourierService } from './services/courier.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { Permission } from 'src/permission/permission.decorator';
import { Action } from 'src/permission/action.enum';
import { CreateCourierProviderDto } from './dto/create-courier-provider.dto';
import { UpdateCourierProviderDto } from './dto/update-courier-provider.dto';

@Controller('courier')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CourierController {
  constructor(private readonly courierService: CourierService) {}

  @Get('providers')
  @Permission(Action.COURIER_VIEW)
  getProviders() {
    return this.courierService.getProviders();
  }

  @Post('providers')
  @Permission(Action.COURIER_MANAGE)
  addProvider(@Body() dto: CreateCourierProviderDto, @Req() req: any) {
    return this.courierService.addProvider(dto, req?.user?.userId);
  }

  @Patch('providers/:id')
  @Permission(Action.COURIER_MANAGE)
  updateProvider(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCourierProviderDto,
    @Req() req: any,
  ) {
    return this.courierService.updateProvider(id, dto, req?.user?.userId);
  }

  @Delete('providers/:id')
  @Permission(Action.COURIER_MANAGE)
  deleteProvider(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.courierService.deleteProvider(id, req?.user?.userId);
  }
}
