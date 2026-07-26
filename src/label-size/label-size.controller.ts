// src/label-size/label-size.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { LabelSizeService } from './label-size.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { Permission } from 'src/permission/permission.decorator';
import { Action } from 'src/permission/action.enum';
import { CreateLabelSizeDto, UpdateLabelSizeDto } from './dto/label-size.dto';

@Controller('label-sizes')
export class LabelSizeController {
  constructor(private labelSizeService: LabelSizeService) {}

  // Public — the Print Labels screen needs this to build its size dropdown.
  @Get()
  findAll() {
    return this.labelSizeService.findAll();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permission(Action.SETTINGS_MANAGE)
  create(@Body() dto: CreateLabelSizeDto) {
    return this.labelSizeService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permission(Action.SETTINGS_MANAGE)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateLabelSizeDto) {
    return this.labelSizeService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permission(Action.SETTINGS_MANAGE)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.labelSizeService.remove(id);
  }

  @Patch(':id/set-default')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permission(Action.SETTINGS_MANAGE)
  setDefault(@Param('id', ParseIntPipe) id: number) {
    return this.labelSizeService.setDefault(id);
  }
}
