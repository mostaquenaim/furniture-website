/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class GuestService {
  constructor(private prisma: PrismaService) {}

  // create visitor id
  createVisitor(visitorId: string) {
    if (!visitorId) return null;

    return this.prisma.visitor.upsert({
      where: { id: visitorId },
      update: {}, // nothing to update for now
      create: {
        id: visitorId,
      },
    });
  }
}
