/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Controller, Get, Patch, Body, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { Permission } from 'src/permission/permission.decorator';
import { Action } from 'src/permission/action.enum';
import { CompanyService } from './company.service';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { UpdatePrivacyPolicyDto } from './dto/update-privacy-policy.dto';

@Controller('company')
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Get()
  get() {
    return this.companyService.get();
  }

  @Patch()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permission(Action.COMPANY_MANAGE)
  update(@Body() dto: UpdateCompanyDto, @Req() req: any) {
    return this.companyService.update(dto, req?.user?.userId);
  }

  // Separate from PATCH /company so the CMS privacy-policy editor works for
  // roles that hold CMS_PRIVACY_POLICY_MANAGE but not COMPANY_MANAGE.
  @Patch('privacy-policy')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permission(Action.CMS_PRIVACY_POLICY_MANAGE)
  updatePrivacyPolicy(@Body() dto: UpdatePrivacyPolicyDto, @Req() req: any) {
    return this.companyService.updatePrivacyPolicy(
      dto.privacyPolicy,
      req?.user?.userId,
    );
  }
}
