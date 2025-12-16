import { Body, Controller, Get, Query } from '@nestjs/common';
import { PermissionService } from './permission.service';

@Controller('permission')
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  // get roles against frontend url
  @Get('/roles-against-url')
  getRolesAgainstURL(@Query('path') path: string) {
    // console.log(path);
    return this.permissionService.getRolesAgainstURL(path);
  }
}
