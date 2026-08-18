import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ActivityLogService } from 'src/activity-log/activity-log.service';
import { PermissionService } from 'src/permission/permission.service';
import { ApiClientController } from './api-client.controller';
import { ApiClientService } from './api-client.service';
import { ApiKeyGuard } from './guards/api-key.guard';
import { ApiScopeGuard } from './guards/api-scope.guard';
import { ApiRateLimitGuard } from './guards/api-rate-limit.guard';
import { ApiUsageLogInterceptor } from './interceptors/api-usage-log.interceptor';

@Module({
  controllers: [ApiClientController],
  providers: [
    ApiClientService,
    PrismaService,
    ActivityLogService,
    // RolesGuard (used by ApiClientController) needs PermissionService
    // resolvable from this module — same pattern InventoryModule follows.
    PermissionService,
    ApiKeyGuard,
    ApiScopeGuard,
    ApiRateLimitGuard,
    ApiUsageLogInterceptor,
  ],
  exports: [
    ApiClientService,
    ApiKeyGuard,
    ApiScopeGuard,
    ApiRateLimitGuard,
    ApiUsageLogInterceptor,
  ],
})
export class ApiClientModule {}
