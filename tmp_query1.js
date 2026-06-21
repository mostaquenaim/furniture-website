const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const advSub = await prisma.subCategory.findFirst({ where: { isAdvancePayment: true } });
  console.log('ADV_SUBCATEGORY', JSON.stringify(advSub));

  const subs = await prisma.subCategory.findMany({ select: { id: true, name: true, isAdvancePayment: true, advancePercentage: true }, take: 10 });
  console.log('SUBCATEGORIES_SAMPLE', JSON.stringify(subs));

  const admin = await prisma.user.findFirst({ where: { role: { not: 'CUSTOMER' } }, select: { id: true, email: true, phone: true, role: true } });
  console.log('ADMIN', JSON.stringify(admin));

  const customer = await prisma.user.findFirst({ where: { role: 'CUSTOMER' }, select: { id: true, email: true, phone: true } });
  console.log('CUSTOMER', JSON.stringify(customer));

  await prisma.$disconnect();
})();
