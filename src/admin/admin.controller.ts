import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { CategoryService } from 'src/category/category.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(private readonly categoryService: CategoryService) {}
  
  // 🔐 ADMIN DASHBOARD BASIC INFO
  @Get('dashboard')
  getDashboard(@Req() req) {
    return {
      message: 'Welcome to Admin Dashboard',
    };
  }

  @Get('all')
  findAll() {
    console.log('in');
    return this.categoryService.findAll();
  }

  // 🔐 ADMIN PROFILE
  @Get('profile')
  getAdminProfile(@Req() req) {
    return req.user;
  }
}
