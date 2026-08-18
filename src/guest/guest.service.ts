import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class GuestService {
  constructor(private prisma: PrismaService) {}

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
