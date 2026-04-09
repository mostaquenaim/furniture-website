/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  Controller,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { HomepageGalleryService } from './homepage-gallery.service';
import { CreateHomepageGalleryDto } from './dto/create-homepage-gallery.dto';
import { UpdateHomepageGalleryDto } from './dto/update-homepage-gallery.dto';
import { Permission } from 'src/permission/permission.decorator';
import { Action } from 'src/permission/action.enum';

@Controller('homepage-gallery')
export class HomepageGalleryController {
  constructor(private readonly service: HomepageGalleryService) {}

  // POST /homepage-gallery
  @Post()
  create(@Body() dto: CreateHomepageGalleryDto) {
    return this.service.create(dto);
  }

  // PUT /homepage-gallery/:id
  @Put(':id')
  @Permission(Action.HOMEPAGE_GALLERY_UPDATE)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateHomepageGalleryDto,
  ) {
    return this.service.update(id, dto);
  }

  // DELETE /homepage-gallery/:id
  @Delete(':id')
  @Permission(Action.HOMEPAGE_GALLERY_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }

  // PUT /homepage-gallery/reorder/bulk
  // Body: { ids: [3, 1, 2] }
  @Put('reorder/bulk')
  @Permission(Action.HOMEPAGE_GALLERY_REORDER)
  reorder(@Body('ids') ids: number[]) {
    return this.service.reorder(ids);
  }
}
