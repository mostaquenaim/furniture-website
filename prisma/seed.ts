/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient();

const sampleData = {
  series: [
    {
      id: 1,
      name: "Living Room",
      slug: "living-room",
      image: "https://example.com/images/series/living-room.jpg",
      notice: "Top-selling series",
      isActive: true,
      sortOrder: 1,
      categories: [
        {
          id: 1,
          slug: "sofas",
          image: "https://example.com/images/categories/sofas.jpg",
          sortOrder: 1,
          isActive: true,
          subCategories: [
            {
              id: 1,
              name: "Leather Sofas",
              slug: "leather-sofas",
              image: "https://example.com/images/subcategories/leather-sofas.jpg",
              sortOrder: 1,
              isActive: true,
              products: [
                {
                  id: 1,
                  title: "Premium Leather Sofa",
                  slug: "premium-leather-sofa",
                  description: "A comfortable leather sofa for 3 persons",
                  basePrice: 1200.0,
                  stock: 10,
                  isActive: true,
                  productImage: [
                    {
                      id: 1,
                      url: "https://example.com/images/products/premium-leather-sofa.jpg",
                    },
                  ],
                },
                {
                  id: 2,
                  title: "Luxury Recliner Sofa",
                  slug: "luxury-recliner-sofa",
                  description: "Recliner sofa with leather finish",
                  basePrice: 1500.0,
                  stock: 5,
                  isActive: true,
                  productImage: [
                    {
                      id: 2,
                      url: "https://example.com/images/products/luxury-recliner-sofa.jpg",
                    },
                  ],
                },
              ],
            },
            {
              id: 2,
              name: "Fabric Sofas",
              slug: "fabric-sofas",
              image: "https://example.com/images/subcategories/fabric-sofas.jpg",
              sortOrder: 2,
              isActive: true,
              products: [
                {
                  id: 3,
                  title: "Modern Fabric Sofa",
                  slug: "modern-fabric-sofa",
                  description: "Comfortable 3-seater fabric sofa",
                  basePrice: 900.0,
                  stock: 15,
                  isActive: true,
                  productImage: [
                    {
                      id: 3,
                      url: "https://example.com/images/products/modern-fabric-sofa.jpg",
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          id: 2,
          slug: "coffee-tables",
          image: "https://example.com/images/categories/coffee-tables.jpg",
          sortOrder: 2,
          isActive: true,
          subCategories: [
            {
              id: 3,
              name: "Wooden Coffee Tables",
              slug: "wooden-coffee-tables",
              image: "https://example.com/images/subcategories/wooden-coffee-tables.jpg",
              sortOrder: 1,
              isActive: true,
              products: [
                {
                  id: 4,
                  title: "Classic Wooden Coffee Table",
                  slug: "classic-wooden-coffee-table",
                  description: "Elegant wooden coffee table",
                  basePrice: 250.0,
                  stock: 20,
                  isActive: true,
                  productImage: [
                    {
                      id: 4,
                      url: "https://example.com/images/products/classic-wooden-coffee-table.jpg",
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          id: 3,
          slug: "tv-stands",
          image: "https://example.com/images/categories/tv-stands.jpg",
          sortOrder: 3,
          isActive: true,
          subCategories: [
            {
              id: 4,
              name: "Modern TV Stands",
              slug: "modern-tv-stands",
              image: "https://example.com/images/subcategories/modern-tv-stands.jpg",
              sortOrder: 1,
              isActive: true,
              products: [
                {
                  id: 5,
                  title: "Glass & Metal TV Stand",
                  slug: "glass-metal-tv-stand",
                  description: "Contemporary TV stand with glass shelves",
                  basePrice: 450.0,
                  stock: 8,
                  isActive: true,
                  productImage: [
                    {
                      id: 5,
                      url: "https://example.com/images/products/glass-metal-tv-stand.jpg",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 2,
      name: "Bedroom",
      slug: "bedroom",
      image: "https://example.com/images/series/bedroom.jpg",
      notice: "Cozy & comfortable",
      isActive: true,
      sortOrder: 2,
      categories: [
        {
          id: 4,
          slug: "beds",
          image: "https://example.com/images/categories/beds.jpg",
          sortOrder: 1,
          isActive: true,
          subCategories: [
            {
              id: 5,
              name: "King Size Beds",
              slug: "king-size-beds",
              image: "https://example.com/images/subcategories/king-size-beds.jpg",
              sortOrder: 1,
              isActive: true,
              products: [
                {
                  id: 6,
                  title: "Luxury King Size Bed",
                  slug: "luxury-king-size-bed",
                  description: "Comfortable king-size bed with wooden frame",
                  basePrice: 1800.0,
                  stock: 8,
                  isActive: true,
                  productImage: [
                    {
                      id: 6,
                      url: "https://example.com/images/products/luxury-king-size-bed.jpg",
                    },
                  ],
                },
              ],
            },
            {
              id: 6,
              name: "Queen Size Beds",
              slug: "queen-size-beds",
              image: "https://example.com/images/subcategories/queen-size-beds.jpg",
              sortOrder: 2,
              isActive: true,
              products: [
                {
                  id: 7,
                  title: "Modern Queen Bed",
                  slug: "modern-queen-bed",
                  description: "Sleek queen bed with storage",
                  basePrice: 1200.0,
                  stock: 12,
                  isActive: true,
                  productImage: [
                    {
                      id: 7,
                      url: "https://example.com/images/products/modern-queen-bed.jpg",
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          id: 5,
          slug: "wardrobes",
          image: "https://example.com/images/categories/wardrobes.jpg",
          sortOrder: 2,
          isActive: true,
          subCategories: [
            {
              id: 7,
              name: "Sliding Wardrobes",
              slug: "sliding-wardrobes",
              image: "https://example.com/images/subcategories/sliding-wardrobes.jpg",
              sortOrder: 1,
              isActive: true,
              products: [
                {
                  id: 8,
                  title: "Modern Sliding Wardrobe",
                  slug: "modern-sliding-wardrobe",
                  description: "Space-saving sliding door wardrobe",
                  basePrice: 850.0,
                  stock: 6,
                  isActive: true,
                  productImage: [
                    {
                      id: 8,
                      url: "https://example.com/images/products/modern-sliding-wardrobe.jpg",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 3,
      name: "Kitchen",
      slug: "kitchen",
      image: "https://example.com/images/series/kitchen.jpg",
      notice: "Modern & functional",
      isActive: true,
      sortOrder: 3,
      categories: [
        {
          id: 6,
          slug: "kitchen-cabinets",
          image: "https://example.com/images/categories/kitchen-cabinets.jpg",
          sortOrder: 1,
          isActive: true,
          subCategories: [
            {
              id: 8,
              name: "Modular Kitchen",
              slug: "modular-kitchen",
              image: "https://example.com/images/subcategories/modular-kitchen.jpg",
              sortOrder: 1,
              isActive: true,
              products: [
                {
                  id: 9,
                  title: "Premium Modular Kitchen",
                  slug: "premium-modular-kitchen",
                  description: "Complete modular kitchen setup",
                  basePrice: 3500.0,
                  stock: 4,
                  isActive: true,
                  productImage: [
                    {
                      id: 9,
                      url: "https://example.com/images/products/premium-modular-kitchen.jpg",
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          id: 7,
          slug: "dining-tables",
          image: "https://example.com/images/categories/dining-tables.jpg",
          sortOrder: 2,
          isActive: true,
          subCategories: [
            {
              id: 9,
              name: "Wooden Dining Tables",
              slug: "wooden-dining-tables",
              image: "https://example.com/images/subcategories/wooden-dining-tables.jpg",
              sortOrder: 1,
              isActive: true,
              products: [
                {
                  id: 10,
                  title: "6-Seater Dining Table",
                  slug: "6-seater-dining-table",
                  description: "Solid wood dining table for 6",
                  basePrice: 750.0,
                  stock: 10,
                  isActive: true,
                  productImage: [
                    {
                      id: 10,
                      url: "https://example.com/images/products/6-seater-dining-table.jpg",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 4,
      name: "Office",
      slug: "office",
      image: "https://example.com/images/series/office.jpg",
      notice: "Productive workspace",
      isActive: true,
      sortOrder: 4,
      categories: [
        {
          id: 8,
          slug: "office-desks",
          image: "https://example.com/images/categories/office-desks.jpg",
          sortOrder: 1,
          isActive: true,
          subCategories: [
            {
              id: 10,
              name: "Executive Desks",
              slug: "executive-desks",
              image: "https://example.com/images/subcategories/executive-desks.jpg",
              sortOrder: 1,
              isActive: true,
              products: [
                {
                  id: 11,
                  title: "L-Shaped Executive Desk",
                  slug: "l-shaped-executive-desk",
                  description: "Spacious L-shaped office desk",
                  basePrice: 650.0,
                  stock: 7,
                  isActive: true,
                  productImage: [
                    {
                      id: 11,
                      url: "https://example.com/images/products/l-shaped-executive-desk.jpg",
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          id: 9,
          slug: "office-chairs",
          image: "https://example.com/images/categories/office-chairs.jpg",
          sortOrder: 2,
          isActive: true,
          subCategories: [
            {
              id: 11,
              name: "Ergonomic Chairs",
              slug: "ergonomic-chairs",
              image: "https://example.com/images/subcategories/ergonomic-chairs.jpg",
              sortOrder: 1,
              isActive: true,
              products: [
                {
                  id: 12,
                  title: "Premium Ergonomic Chair",
                  slug: "premium-ergonomic-chair",
                  description: "Office chair with lumbar support",
                  basePrice: 350.0,
                  stock: 15,
                  isActive: true,
                  productImage: [
                    {
                      id: 12,
                      url: "https://example.com/images/products/premium-ergonomic-chair.jpg",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 5,
      name: "Outdoor",
      slug: "outdoor",
      image: "https://example.com/images/series/outdoor.jpg",
      notice: "Weather-resistant furniture",
      isActive: true,
      sortOrder: 5,
      categories: [
        {
          id: 10,
          slug: "patio-furniture",
          image: "https://example.com/images/categories/patio-furniture.jpg",
          sortOrder: 1,
          isActive: true,
          subCategories: [
            {
              id: 12,
              name: "Outdoor Sofas",
              slug: "outdoor-sofas",
              image: "https://example.com/images/subcategories/outdoor-sofas.jpg",
              sortOrder: 1,
              isActive: true,
              products: [
                {
                  id: 13,
                  title: "Rattan Outdoor Sofa Set",
                  slug: "rattan-outdoor-sofa-set",
                  description: "3-piece outdoor sofa set",
                  basePrice: 950.0,
                  stock: 5,
                  isActive: true,
                  productImage: [
                    {
                      id: 13,
                      url: "https://example.com/images/products/rattan-outdoor-sofa-set.jpg",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 6,
      name: "Kids",
      slug: "kids",
      image: "https://example.com/images/series/kids.jpg",
      notice: "Safe & colorful",
      isActive: true,
      sortOrder: 6,
      categories: [
        {
          id: 11,
          slug: "kids-beds",
          image: "https://example.com/images/categories/kids-beds.jpg",
          sortOrder: 1,
          isActive: true,
          subCategories: [
            {
              id: 13,
              name: "Bunk Beds",
              slug: "bunk-beds",
              image: "https://example.com/images/subcategories/bunk-beds.jpg",
              sortOrder: 1,
              isActive: true,
              products: [
                {
                  id: 14,
                  title: "Wooden Bunk Bed",
                  slug: "wooden-bunk-bed",
                  description: "Safe bunk bed with guard rails",
                  basePrice: 650.0,
                  stock: 8,
                  isActive: true,
                  productImage: [
                    {
                      id: 14,
                      url: "https://example.com/images/products/wooden-bunk-bed.jpg",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 7,
      name: "Storage",
      slug: "storage",
      image: "https://example.com/images/series/storage.jpg",
      notice: "Smart storage solutions",
      isActive: true,
      sortOrder: 7,
      categories: [
        {
          id: 12,
          slug: "shelves",
          image: "https://example.com/images/categories/shelves.jpg",
          sortOrder: 1,
          isActive: true,
          subCategories: [
            {
              id: 14,
              name: "Wall Shelves",
              slug: "wall-shelves",
              image: "https://example.com/images/subcategories/wall-shelves.jpg",
              sortOrder: 1,
              isActive: true,
              products: [
                {
                  id: 15,
                  title: "Floating Wall Shelves",
                  slug: "floating-wall-shelves",
                  description: "Set of 3 floating shelves",
                  basePrice: 120.0,
                  stock: 25,
                  isActive: true,
                  productImage: [
                    {
                      id: 15,
                      url: "https://example.com/images/products/floating-wall-shelves.jpg",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 8,
      name: "Lighting",
      slug: "lighting",
      image: "https://example.com/images/series/lighting.jpg",
      notice: "Illuminate your space",
      isActive: true,
      sortOrder: 8,
      categories: [
        {
          id: 13,
          slug: "ceiling-lights",
          image: "https://example.com/images/categories/ceiling-lights.jpg",
          sortOrder: 1,
          isActive: true,
          subCategories: [
            {
              id: 15,
              name: "Chandeliers",
              slug: "chandeliers",
              image: "https://example.com/images/subcategories/chandeliers.jpg",
              sortOrder: 1,
              isActive: true,
              products: [
                {
                  id: 16,
                  title: "Crystal Chandelier",
                  slug: "crystal-chandelier",
                  description: "Elegant crystal ceiling light",
                  basePrice: 450.0,
                  stock: 6,
                  isActive: true,
                  productImage: [
                    {
                      id: 16,
                      url: "https://example.com/images/products/crystal-chandelier.jpg",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 9,
      name: "Decor",
      slug: "decor",
      image: "https://example.com/images/series/decor.jpg",
      notice: "Beautiful accents",
      isActive: true,
      sortOrder: 9,
      categories: [
        {
          id: 14,
          slug: "wall-art",
          image: "https://example.com/images/categories/wall-art.jpg",
          sortOrder: 1,
          isActive: true,
          subCategories: [
            {
              id: 16,
              name: "Canvas Paintings",
              slug: "canvas-paintings",
              image: "https://example.com/images/subcategories/canvas-paintings.jpg",
              sortOrder: 1,
              isActive: true,
              products: [
                {
                  id: 17,
                  title: "Abstract Canvas Painting",
                  slug: "abstract-canvas-painting",
                  description: "Large abstract wall art",
                  basePrice: 180.0,
                  stock: 12,
                  isActive: true,
                  productImage: [
                    {
                      id: 17,
                      url: "https://example.com/images/products/abstract-canvas-painting.jpg",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 10,
      name: "Bathroom",
      slug: "bathroom",
      image: "https://example.com/images/series/bathroom.jpg",
      notice: "Luxury bath fittings",
      isActive: true,
      sortOrder: 10,
      categories: [
        {
          id: 15,
          slug: "vanities",
          image: "https://example.com/images/categories/vanities.jpg",
          sortOrder: 1,
          isActive: true,
          subCategories: [
            {
              id: 17,
              name: "Bathroom Vanities",
              slug: "bathroom-vanities",
              image: "https://example.com/images/subcategories/bathroom-vanities.jpg",
              sortOrder: 1,
              isActive: true,
              products: [
                {
                  id: 18,
                  title: "Marble Top Vanity",
                  slug: "marble-top-vanity",
                  description: "Double sink bathroom vanity",
                  basePrice: 850.0,
                  stock: 4,
                  isActive: true,
                  productImage: [
                    {
                      id: 18,
                      url: "https://example.com/images/products/marble-top-vanity.jpg",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 11,
      name: "Entertainment",
      slug: "entertainment",
      image: "https://example.com/images/series/entertainment.jpg",
      notice: "Home theater solutions",
      isActive: true,
      sortOrder: 11,
      categories: [
        {
          id: 16,
          slug: "home-theater",
          image: "https://example.com/images/categories/home-theater.jpg",
          sortOrder: 1,
          isActive: true,
          subCategories: [
            {
              id: 18,
              name: "Media Consoles",
              slug: "media-consoles",
              image: "https://example.com/images/subcategories/media-consoles.jpg",
              sortOrder: 1,
              isActive: true,
              products: [
                {
                  id: 19,
                  title: "Entertainment Center",
                  slug: "entertainment-center",
                  description: "Large media console with storage",
                  basePrice: 750.0,
                  stock: 6,
                  isActive: true,
                  productImage: [
                    {
                      id: 19,
                      url: "https://example.com/images/products/entertainment-center.jpg",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 12,
      name: "Accent",
      slug: "accent",
      image: "https://example.com/images/series/accent.jpg",
      notice: "Statement pieces",
      isActive: true,
      sortOrder: 12,
      categories: [
        {
          id: 17,
          slug: "accent-chairs",
          image: "https://example.com/images/categories/accent-chairs.jpg",
          sortOrder: 1,
          isActive: true,
          subCategories: [
            {
              id: 19,
              name: "Armchairs",
              slug: "armchairs",
              image: "https://example.com/images/subcategories/armchairs.jpg",
              sortOrder: 1,
              isActive: true,
              products: [
                {
                  id: 20,
                  title: "Velvet Accent Chair",
                  slug: "velvet-accent-chair",
                  description: "Luxury velvet reading chair",
                  basePrice: 450.0,
                  stock: 9,
                  isActive: true,
                  productImage: [
                    {
                      id: 20,
                      url: "https://example.com/images/products/velvet-accent-chair.jpg",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

async function main() {
  console.log('⏳ Seeding data...');

  for (const seriesItem of sampleData.series) {
    // Create or Update Series
    const series = await prisma.series.upsert({
      where: { slug: seriesItem.slug },
      update: {
        name: seriesItem.name,
        image: seriesItem.image,
        notice: seriesItem.notice,
        isActive: seriesItem.isActive,
        sortOrder: seriesItem.sortOrder,
      },
      create: {
        name: seriesItem.name,
        slug: seriesItem.slug,
        image: seriesItem.image,
        notice: seriesItem.notice,
        isActive: seriesItem.isActive,
        sortOrder: seriesItem.sortOrder,
      },
    });

    for (const categoryItem of seriesItem.categories) {
      // Create or Update Category (Unique by seriesId and slug)
      const category = await prisma.category.upsert({
        where: {
          seriesId_slug: {
            seriesId: series.id,
            slug: categoryItem.slug,
          },
        },
        update: {
          image: categoryItem.image,
          sortOrder: categoryItem.sortOrder,
          isActive: categoryItem.isActive,
        },
        create: {
          slug: categoryItem.slug,
          image: categoryItem.image,
          sortOrder: categoryItem.sortOrder,
          isActive: categoryItem.isActive,
          seriesId: series.id,
        },
      });

      for (const subItem of categoryItem.subCategories) {
        // Create or Update SubCategory (Unique by categoryId and slug)
        await prisma.subCategory.upsert({
          where: {
            categoryId_slug: {
              categoryId: category.id,
              slug: subItem.slug,
            },
          },
          update: {
            name: subItem.name,
            image: subItem.image,
            sortOrder: subItem.sortOrder,
            isActive: subItem.isActive,
          },
          create: {
            name: subItem.name,
            slug: subItem.slug,
            image: subItem.image,
            sortOrder: subItem.sortOrder,
            isActive: subItem.isActive,
            categoryId: category.id,
          },
        });
      }
    }
  }

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