import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

// Shared by AdminUsersService.deleteUser and UserService.remove — both are
// SUPERADMIN-gated deletes of the same User row and must apply the same
// safety checks (never delete a SUPERADMIN, refuse deletion when the user
// has data other tables depend on, and clean up the rows that are safe to
// cascade before the actual delete).
export async function deleteUserSafely(prisma: PrismaService, id: number) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      orders: true,
      activityLogs: true,
      supportTickets: true,
      assignedTickets: true,
      ticketMessages: true,
    },
  });

  if (!user) {
    throw new NotFoundException('User not found');
  }

  if (user.role === 'SUPERADMIN') {
    throw new ForbiddenException('Cannot delete a SUPERADMIN account.');
  }

  if (
    user.orders.length > 0 ||
    user.activityLogs.length > 0 ||
    user.supportTickets.length > 0 ||
    user.assignedTickets.length > 0 ||
    user.ticketMessages.length > 0
  ) {
    throw new BadRequestException(
      'User has associated data. Deactivate instead.',
    );
  }

  await prisma.cartItem.deleteMany({
    where: { cart: { userId: id } },
  });

  await prisma.oTP.deleteMany({
    where: { userId: id },
  });

  await prisma.user.delete({ where: { id } });

  return { message: 'User deleted successfully' };
}
