import { Module } from '@nestjs/common';
import { ContactController } from './contact.controller';
import { ContactService } from './contact.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { PermissionService } from 'src/permission/permission.service';

@Module({
  controllers: [ContactController],
  providers: [ContactService, PrismaService, PermissionService]
})
export class ContactModule {}
