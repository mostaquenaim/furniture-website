import { Controller, Get, Post, Put, Body, Param, Query } from '@nestjs/common';
import { ShippingService } from './shipping.service';
import { UpdateDistrictDto } from './dto/update-district.dto';
import { CalculateShippingDto } from './dto/calculate-shipping.dto';
import { AwbDto } from './dto/awb.dto';
import { LabelDto } from './dto/label.dto';
import { TrackDto } from './dto/track.dto';

@Controller('shipping')
export class ShippingController {
  constructor(private readonly service: ShippingService) {}

  @Get('districts') getDistricts() { return this.service.getDistricts(); }

  @Put('districts/:id') updateDistrict(@Param('id') id: string, @Body() dto: UpdateDistrictDto) {
    return this.service.updateDistrict(id, dto);
  }

  @Get('calculate') calculate(@Query() dto: CalculateShippingDto) {
    return this.service.calculateShipping(dto);
  }

  @Get('cod-eligible') codEligible(@Query('district') district: string) {
    return this.service.codEligible(district);
  }

  @Post('awb') generateAwb(@Body() dto: AwbDto) { return this.service.generateAwb(dto); }

  @Post('label') generateLabel(@Body() dto: LabelDto) { return this.service.generateLabel(dto); }

  @Post('track') track(@Body() dto: TrackDto) { return this.service.trackShipment(dto); }
}
