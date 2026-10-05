import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { isUUID } from 'class-validator';
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

  // move a legacy (non-UUID) visitor's active cart and recently-viewed
  // history onto a brand-new UUID visitor
  async migrateVisitor(from: string, to: string) {
    // @Body('from') is untyped — guard the type so isUUID can't throw (500)
    if (
      typeof from !== 'string' ||
      !from ||
      from.length > 100 ||
      isUUID(from)
    ) {
      throw new BadRequestException(
        'from must be a legacy (non-UUID) visitorId',
      );
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        // creating `to` doubles as the "must not exist yet" check — it fails
        // with P2002 if it does, so an old ID can't be merged into someone
        // else's visitor
        await tx.visitor.create({ data: { id: to } });

        const { count } = await tx.cart.updateMany({
          where: { visitorId: from, userId: null, status: 'ACTIVE' },
          data: { visitorId: to },
        });

        // `to` was just created, so it has no views that could clash with
        // the @@unique([productId, userId, visitorId])
        await tx.productView.updateMany({
          where: { visitorId: from, userId: null },
          data: { visitorId: to },
        });

        return { migrated: count > 0 };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Target visitor already exists');
      }
      throw error;
    }
  }
}
