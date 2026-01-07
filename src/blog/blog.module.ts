import { Module } from '@nestjs/common';
import { BlogsController } from './blog.controller';
import { BlogsService } from './blog.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [BlogsController],
  providers: [BlogsService, PrismaService],
})
export class BlogsModule {}
