/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { PrismaClient } from "../src/generated/prisma/client";
const prisma = new PrismaClient();

async function main() {
  // --- Category ---
  const furniture = await prisma.category.create({
    data: {
      name: 'Furniture',
      slug: 'furniture',
      subcategories: {
        create: [
          {
            name: 'Sofas',
            slug: 'sofas',
          },
          {
            name: 'Beds',
            slug: 'beds',
          },
        ],
      },
    },
    include: { subcategories: true },
  });

  // --- Rooms ---
  const livingRoom = await prisma.room.create({
    data: { name: 'Living Room', slug: 'living-room' },
  });

  const bedroom = await prisma.room.create({
    data: { name: 'Bedroom', slug: 'bedroom' },
  });

  // Link rooms to subcategory (Sofas → Living Room)
  await prisma.subcategory.update({
    where: { id: furniture.subcategories[0].id }, // Sofas
    data: {
      rooms: {
        connect: [{ id: livingRoom.id }],
      },
    },
  });

  // --- Products ---
  await prisma.product.create({
    data: {
      title: 'Premium Fabric Sofa',
      slug: 'premium-fabric-sofa',
      basePrice: 32990,
      stock: 10,
      images: [
        'sofa1.jpg',
        'sofa2.jpg'
      ],
      subcategoryId: furniture.subcategories[0].id, // Sofas
    },
  });

  await prisma.product.create({
    data: {
      title: 'King Size Wooden Bed',
      slug: 'king-size-wooden-bed',
      basePrice: 49990,
      stock: 5,
      images: [
        'bed1.jpg',
        'bed2.jpg'
      ],
      subcategoryId: furniture.subcategories[1].id, // Beds
    },
  });

  console.log('🌱 Seed data inserted successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

