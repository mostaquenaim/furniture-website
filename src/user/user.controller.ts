import { Controller, Get, Put, Delete, Param, Body, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { SuspendUserDto } from './dto/suspend-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  findAll() {
    return this.userService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.userService.findOne(id);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto) {
    return this.userService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.userService.remove(id);
  }

  @Get(':id/orders')
  getOrders(@Param('id', ParseIntPipe) id: number) {
    return this.userService.getOrders(id);
  }

  @Get(':id/wishlist')
  getWishlist(@Param('id', ParseIntPipe) id: number) {
    return this.userService.getWishlist(id);
  }

  @Get(':id/reviews')
  getReviews(@Param('id', ParseIntPipe) id: number) {
    return this.userService.getReviews(id);
  }

  @Put(':id/reviews')
  hideReviews(@Param('id', ParseIntPipe) id: number, @Body('reviewIds') reviewIds: number[], @Body('hide') hide = true) {
    return this.userService.hideReviews(id, reviewIds, hide);
  }

  @Post('suspend')
  suspendUser(@Body() dto: SuspendUserDto) {
    return this.userService.suspendUser(dto);
  }
}
