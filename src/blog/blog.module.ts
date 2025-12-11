import { Module } from '@nestjs/common';
import { BlogsController } from './blog.controller';
import { BlogsService } from './blog.service';

@Module({
  controllers: [BlogsController],
  providers: [BlogsService],
})
export class BlogsModule {}
