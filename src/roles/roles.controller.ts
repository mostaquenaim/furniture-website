import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { RolesService } from './roles.service';

@Controller('roles')
export class RolesController {
  constructor(private readonly service: RolesService) {}

  @Get() getAll() { return this.service.getAll(); }

  @Post()
  createRole(@Body('name') name: string) {
    return this.service.createRole(name);
  }

  @Put(':id')
  updateRole(@Param('id') id: string, @Body('name') name: string) {
    return this.service.updateRole(id, name);
  }

  @Delete(':id')
  deleteRole(@Param('id') id: string) {
    return this.service.deleteRole(id);
  }

  @Get(':id/permissions')
  getPermissions(@Param('id') id: string) {
    return this.service.getPermissions(id);
  }

  @Post(':id/permissions')
  assignPermissions(@Param('id') id: string, @Body('permissions') permissions: string[]) {
    return this.service.assignPermissions(id, permissions);
  }
}
