const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();
(async () => {
  const hash = await bcrypt.hash('Verify@1234', 10);

  await prisma.user.update({ where: { id: 1 }, data: { password: hash } });
  await prisma.user.update({ where: { id: 2 }, data: { password: hash } });

  const sub = await prisma.subCategory.update({
    where: { id: 20 },
    data: { isAdvancePayment: true, advancePercentage: 20 },
  });
  console.log('UPDATED_SUBCATEGORY', JSON.stringify(sub));

  console.log('PASSWORDS SET for user 1 (test@gmail.com) and user 2 (admin@sakigai.com) -> Verify@1234');
  await prisma.$disconnect();
})();
