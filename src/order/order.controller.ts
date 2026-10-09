/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Req,
  Query,
  ForbiddenException,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionService } from 'src/permission/permission.service';
import { Action } from 'src/permission/action.enum';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderStatus, UserRole } from '@prisma/client';
import { RefundService } from '../refund/refund.service';
import { CreateReturnRequestDto } from '../refund/dto/create-return-request.dto';
import { parseSortParams } from 'src/common/utils/sort.utils';

const ORDER_SORT_FIELDS = {
  createdAt: 'createdAt',
  total: 'total',
  status: 'status',
} as const;

@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly refundService: RefundService,
    private readonly permissionService: PermissionService,
  ) {}

  // Shared route: CUSTOMER callers get their own orders (service scopes by
  // userId), staff/admin callers get every order. RolesGuard can't sit on
  // this route as a whole — CUSTOMER has no RolePermission rows, so it would
  // block customers from their own order history. Instead, only check
  // ORDER_VIEW for non-CUSTOMER callers, mirroring RolesGuard's own
  // SUPERADMIN-bypass logic for the staff-only half of this endpoint.
  @Get('all')
  async getAllOrders(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: OrderStatus,
    @Query('sortBy') sortBy?: string,
    @Query('order') order?: string,
    @Query('thumb') thumb?: boolean,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('customerType') customerType?: 'guest' | 'registered',
  ) {
    const role: UserRole = req?.user?.role;
    if (role && role !== UserRole.CUSTOMER && role !== UserRole.SUPERADMIN) {
      const allowed = await this.permissionService.isAllowed(
        role,
        Action.ORDER_VIEW,
      );
      if (!allowed) {
        throw new ForbiddenException(
          `Role ${role} does not have permission: ${Action.ORDER_VIEW}`,
        );
      }
    }

    const sort = parseSortParams(sortBy, order, ORDER_SORT_FIELDS, 'desc');

    return this.orderService.getAllOrders(req?.user?.userId, {
      page: Number(page) || 1,
      limit: Number(limit) || 5,
      search,
      status,
      // id tie-breaker keeps pages stable when many orders share a status
      // or total; status sorts in enum (lifecycle) order, not alphabetically
      orderBy: sort
        ? [{ [sort.field]: sort.direction }, { id: sort.direction }]
        : undefined,
      thumb,
      from,
      to,
      customerType,
    });
  }

  @Post('create')
  create(@Req() req, @Body() dto: CreateOrderDto) {
    return this.orderService.createOrder(req?.user?.userId, dto);
  }

  @Get('/track/:orderId')
  trackOrder(
    @Req() req,
    @Param('orderId') orderId: string,
    @Query('details') details: string,
  ) {
    const detailsValue = details === 'true';

    return this.orderService.trackOrder(req?.user?.userId, orderId, {
      detailsValue,
    });
  }

  // ── Returns (customer-facing)
  @Get('return-requests')
  listMyReturnRequests(@Req() req: any, @Query('orderId') orderId?: string) {
    return this.refundService.listMyReturnRequests(req?.user?.userId, orderId);
  }

  @Get('return-requests/:id')
  getMyReturnRequest(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.refundService.getReturnRequestForCustomer(
      id,
      req?.user?.userId,
    );
  }

  @Patch('return-requests/:id/cancel')
  cancelMyReturnRequest(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.refundService.cancelReturnRequest(id, req?.user?.userId);
  }

  @Post(':orderId/return-request')
  createReturnRequest(
    @Req() req: any,
    @Param('orderId') orderId: string,
    @Body() dto: CreateReturnRequestDto,
  ) {
    return this.refundService.createReturnRequest(
      orderId,
      dto,
      req?.user?.userId,
      req?.user?.role !== 'CUSTOMER',
    );
  }
}
