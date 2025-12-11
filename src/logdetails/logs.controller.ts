import { Controller, Get, Delete, Param } from '@nestjs/common';
import { LogsService } from './logs.service';

@Controller('logs')
export class LogsController {
  constructor(private readonly service: LogsService) {}

  @Get() getAll() { return this.service.getAll(); }

  @Get('user/:userId') getUserLogs(@Param('userId') userId: string) {
    return this.service.getUserLogs(userId);
  }

  @Get('admin') getAdminLogs() { return this.service.getAdminLogs(); }

  @Delete(':id') deleteLog(@Param('id') id: string) { return this.service.deleteLog(id); }
}
