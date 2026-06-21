const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const products = await prisma.product.findMany({
    where: { subCategories: { some: { subCategoryId: 16 } }, isActive: true },
    select: {
      id: true, title: true, slug: true,
      colors: { select: { id: true, sizes: { select: { id: true, quantity: true, price: true, sku: true } } } },
    },
    take: 5,
  });
  console.log('PRODUCTS', JSON.stringify(products, null, 2));

  // Check a district that allows COD
  const district = await prisma.city.findFirst({ where: { isCODAvailable: true }, select: { id: true, name: true, deliveryFee: true } });
  console.log('DISTRICT', JSON.stringify(district));

  await prisma.$disconnect();
})();
