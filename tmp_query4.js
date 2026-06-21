const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const superadmins = await prisma.user.findMany({ where: { role: 'SUPERADMIN' }, select: { id: true, email: true, phone: true } });
  console.log('SUPERADMINS', JSON.stringify(superadmins));
  await prisma.$disconnect();
})();
