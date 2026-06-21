const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const productSizes = await prisma.productSize.findMany({
    where: { quantity: { gt: 0 } },
    select: {
      id: true, price: true, quantity: true, sku: true,
      color: { select: { id: true, productId: true, product: {
        select: { id: true, title: true, slug: true, isActive: true,
          subCategories: { select: { subCategoryId: true, subCategory: { select: { id: true, name: true, isCODAvailable: true, isAdvancePayment: true } } } } }
      } } }
    },
    take: 5,
  });
  console.log('STOCKED_SIZES', JSON.stringify(productSizes, null, 2));
  await prisma.$disconnect();
})();
