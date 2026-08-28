// Shared demo/dev data generation. Used by:
//  - prisma/seed.ts (CLI `npx prisma db seed`), gated on demo-mode there
//  - src/demo/demo-reset.service.ts (scheduled Render demo reset)
//  - src/demo/demo-generate.controller.ts (one-off "Generate random X" buttons)
// Kept under src/ (not prisma/) so it compiles as part of the normal Nest
// build — prisma/seed.ts imports from here, never the other way around.
import { PrismaClient, UserRole } from '@prisma/client';
import { faker } from '@faker-js/faker';
import { hashPassword } from '../common/utils/password.utils';
import districtsData from '../cms/data/districtData';

export const DEMO_PASSWORD = 'Demo@1234';

export const DEMO_ACCOUNTS: {
  email: string;
  role: UserRole;
  phone?: string;
  name: string;
}[] = [
  {
    email: 'demo-admin@sakigai.com',
    role: UserRole.SUPERADMIN,
    name: 'Demo Super Admin',
  },
  {
    email: 'demo-productmanager@sakigai.com',
    role: UserRole.PRODUCTMANAGER,
    name: 'Demo Product Manager',
  },
  {
    email: 'demo-ordermanager@sakigai.com',
    role: UserRole.ORDERMANAGER,
    name: 'Demo Order Manager',
  },
  {
    email: 'demo-support@sakigai.com',
    role: UserRole.SUPPORT,
    name: 'Demo Support Agent',
  },
  {
    email: 'demo-customer@sakigai.com',
    role: UserRole.CUSTOMER,
    phone: '+8801700000000',
    name: 'Demo Customer',
  },
];

const MATERIALS = [
  'Solid Wood',
  'Engineered Wood',
  'Metal',
  'Glass',
  'Leather',
];

const COLORS: { name: string; hexCode: string }[] = [
  { name: 'Walnut Brown', hexCode: '#5C4033' },
  { name: 'Charcoal Black', hexCode: '#36454F' },
  { name: 'Ivory White', hexCode: '#F5F0E6' },
  { name: 'Forest Green', hexCode: '#2E4635' },
  { name: 'Navy Blue', hexCode: '#1B2A4A' },
];

const SIZE_NAMES = ['Small', 'Medium', 'Large'];

const CATALOG_TREE: {
  series: string;
  category: string;
  subCategories: string[];
}[] = [
  {
    series: 'Living',
    category: 'Living Room',
    subCategories: ['Sofas', 'Coffee Tables', 'TV Stands'],
  },
  {
    series: 'Bedroom',
    category: 'Bedroom',
    subCategories: ['Beds', 'Wardrobes', 'Nightstands'],
  },
  {
    series: 'Office',
    category: 'Office',
    subCategories: ['Desks', 'Office Chairs'],
  },
];

const PRODUCT_TEMPLATES: {
  title: string;
  subCategory: string;
  basePrice: number;
}[] = [
  { title: 'Oakwood 3-Seater Sofa', subCategory: 'Sofas', basePrice: 68000 },
  { title: 'Linen Fabric Loveseat', subCategory: 'Sofas', basePrice: 42000 },
  {
    title: 'Marble Top Coffee Table',
    subCategory: 'Coffee Tables',
    basePrice: 21000,
  },
  {
    title: 'Round Glass Coffee Table',
    subCategory: 'Coffee Tables',
    basePrice: 15500,
  },
  { title: 'Walnut TV Stand', subCategory: 'TV Stands', basePrice: 27500 },
  {
    title: 'King Size Platform Bed',
    subCategory: 'Beds',
    basePrice: 85000,
  },
  { title: 'Queen Size Bed Frame', subCategory: 'Beds', basePrice: 62000 },
  { title: '3-Door Wardrobe', subCategory: 'Wardrobes', basePrice: 54000 },
  {
    title: 'Bedside Nightstand',
    subCategory: 'Nightstands',
    basePrice: 9500,
  },
  {
    title: 'Executive L-Shape Desk',
    subCategory: 'Desks',
    basePrice: 38000,
  },
  { title: 'Compact Writing Desk', subCategory: 'Desks', basePrice: 17500 },
  {
    title: 'Ergonomic Mesh Office Chair',
    subCategory: 'Office Chairs',
    basePrice: 24500,
  },
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function placeholderImage(seed: string, width = 800, height = 800): string {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${width}/${height}`;
}

export async function seedDemoUsers(prisma: PrismaClient) {
  const hashed = await hashPassword(DEMO_PASSWORD);

  for (const account of DEMO_ACCOUNTS) {
    await prisma.user.upsert({
      where: { email: account.email },
      update: {},
      create: {
        email: account.email,
        phone: account.phone,
        name: account.name,
        password: hashed,
        role: account.role,
        isVerified: true,
        isActive: true,
      },
    });
  }
}

export async function seedDemoDistricts(prisma: PrismaClient) {
  const deliveryFee = Number(process.env.DEFAULT_DELIVERY_FEE) || 120;

  for (const district of districtsData) {
    const name = district.name.trim();
    await prisma.city.upsert({
      where: { name },
      update: {},
      create: { name, deliveryFee },
    });
  }
}

async function seedMaterials(prisma: PrismaClient) {
  for (const name of MATERIALS) {
    await prisma.material.upsert({
      where: { slug: slugify(name) },
      update: {},
      create: { name, slug: slugify(name) },
    });
  }
  return prisma.material.findMany({ where: { name: { in: MATERIALS } } });
}

async function seedColors(prisma: PrismaClient) {
  const colors: { id: number }[] = [];
  for (const color of COLORS) {
    const existing = await prisma.color.findFirst({
      where: { name: color.name },
    });
    colors.push(
      existing ??
        (await prisma.color.create({
          data: { name: color.name, hexCode: color.hexCode },
        })),
    );
  }
  return colors;
}

async function seedSizes(prisma: PrismaClient) {
  const variant =
    (await prisma.variant.findFirst({ where: { name: 'Size' } })) ??
    (await prisma.variant.create({ data: { name: 'Size' } }));

  const sizes: { id: number; name: string }[] = [];
  for (const name of SIZE_NAMES) {
    const existing = await prisma.size.findFirst({
      where: { name, variantId: variant.id },
    });
    sizes.push(
      existing ??
        (await prisma.size.create({
          data: { name, variantId: variant.id },
        })),
    );
  }
  return sizes;
}

async function seedCatalogTree(prisma: PrismaClient) {
  const subCategoryByName = new Map<string, number>();

  for (const branch of CATALOG_TREE) {
    const series = await prisma.series.upsert({
      where: { slug: slugify(branch.series) },
      update: {},
      create: {
        name: branch.series,
        slug: slugify(branch.series),
        seriesType: 'NORMAL',
      },
    });

    const category = await prisma.category.upsert({
      where: { slug: slugify(branch.category) },
      update: {},
      create: {
        name: branch.category,
        slug: slugify(branch.category),
        seriesId: series.id,
      },
    });

    for (const subName of branch.subCategories) {
      const subCategory = await prisma.subCategory.upsert({
        where: { slug: slugify(subName) },
        update: {},
        create: {
          name: subName,
          slug: slugify(subName),
          categoryId: category.id,
        },
      });
      subCategoryByName.set(subName, subCategory.id);
    }
  }

  return subCategoryByName;
}

async function createProductRecord(
  prisma: PrismaClient,
  opts: {
    title: string;
    slug: string;
    basePrice: number;
    subCategoryId?: number;
    materials: { id: number }[];
    colors: { id: number }[];
    sizes: { id: number }[];
  },
) {
  const { title, slug, basePrice, subCategoryId, materials, colors, sizes } =
    opts;
  const material = faker.helpers.arrayElement(materials);
  const productColors = faker.helpers.arrayElements(
    colors,
    Math.min(2, colors.length),
  );

  return prisma.product.create({
    data: {
      title,
      slug,
      sku: `SKU-${slug.toUpperCase().slice(0, 12)}`,
      description: faker.commerce.productDescription(),
      basePrice,
      materialId: material.id,
      isActive: true,
      isFeatured: faker.datatype.boolean(),
      subCategories: subCategoryId ? { create: { subCategoryId } } : undefined,
      images: {
        create: [0, 1].map((n) => ({
          image: placeholderImage(`${slug}-${n}`),
          serialNo: n,
        })),
      },
      colors: {
        create: productColors.map((color) => ({
          colorId: color.id,
          images: {
            create: [0].map((n) => ({
              image: placeholderImage(`${slug}-${color.id}-${n}`),
              serialNo: n,
            })),
          },
          sizes: {
            create: sizes.map((size) => ({
              sizeId: size.id,
              sku: `SKU-${slug.toUpperCase().slice(0, 8)}-${color.id}-${size.id}`,
              basePrice,
              quantity: faker.number.int({ min: 5, max: 40 }),
            })),
          },
        })),
      },
    },
  });
}

export async function seedDemoProducts(prisma: PrismaClient) {
  const materials = await seedMaterials(prisma);
  const colors = await seedColors(prisma);
  const sizes = await seedSizes(prisma);
  const subCategoryByName = await seedCatalogTree(prisma);

  const createdProducts: { id: number; title: string }[] = [];

  for (const template of PRODUCT_TEMPLATES) {
    const slug = slugify(template.title);
    const existing = await prisma.product.findUnique({ where: { slug } });
    if (existing) {
      createdProducts.push({ id: existing.id, title: existing.title });
      continue;
    }

    const product = await createProductRecord(prisma, {
      title: template.title,
      slug,
      basePrice: template.basePrice,
      subCategoryId: subCategoryByName.get(template.subCategory),
      materials,
      colors,
      sizes,
    });

    createdProducts.push({ id: product.id, title: product.title });
  }

  return createdProducts;
}

/** Used by the "Generate Random Product" admin button (demo/dev only). */
export async function generateRandomProduct(prisma: PrismaClient) {
  const materials = await seedMaterials(prisma);
  const colors = await seedColors(prisma);
  const sizes = await seedSizes(prisma);
  const subCategoryByName = await seedCatalogTree(prisma);
  const subCategoryIds = [...subCategoryByName.values()];

  const noun = faker.helpers.arrayElement([
    'Sofa',
    'Coffee Table',
    'Bed Frame',
    'Wardrobe',
    'Desk',
    'Office Chair',
    'Bookshelf',
    'Dining Table',
  ]);
  const title = `${faker.commerce.productAdjective()} ${noun} ${faker.string.alphanumeric(4).toUpperCase()}`;
  const slug = slugify(title);

  return createProductRecord(prisma, {
    title,
    slug,
    basePrice: faker.number.int({ min: 8000, max: 90000 }),
    subCategoryId: subCategoryIds.length
      ? faker.helpers.arrayElement(subCategoryIds)
      : undefined,
    materials,
    colors,
    sizes,
  });
}

export async function seedDemoMarketing(prisma: PrismaClient) {
  const existingBanner = await prisma.banner.findFirst({
    where: { title: 'Living Room Refresh' },
  });
  if (!existingBanner) {
    await prisma.banner.create({
      data: {
        title: 'Living Room Refresh',
        image: placeholderImage('banner-living-room', 1600, 500),
        link: '/series/living',
        active: true,
      },
    });
  }

  const existingBroadBanner = await prisma.broadBanner.findFirst({
    where: { title: 'New Season Arrivals' },
  });
  if (!existingBroadBanner) {
    await prisma.broadBanner.create({
      data: {
        title: 'New Season Arrivals',
        image: placeholderImage('broad-banner', 1600, 400),
        link: '/series/bedroom',
      },
    });
  }

  const existingPromo = await prisma.promoBanner.findFirst({
    where: { title: 'Free Delivery Week' },
  });
  if (!existingPromo) {
    await prisma.promoBanner.create({
      data: {
        title: 'Free Delivery Week',
        text: 'Free delivery on all orders this week',
        bgColor: '#0f172a',
        links: {
          create: [
            { text: 'Shop Living Room', url: '/series/living' },
            { text: 'Shop Bedroom', url: '/series/bedroom' },
          ],
        },
      },
    });
  }

  await prisma.coupon.upsert({
    where: { code: 'WELCOME10' },
    update: {},
    create: {
      code: 'WELCOME10',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      maxDiscount: 2000,
      minOrderValue: 5000,
      expiryDate: faker.date.future({ years: 1 }),
      usageLimit: 500,
      perUserLimit: 1,
    },
  });

  await prisma.coupon.upsert({
    where: { code: 'FREESHIP' },
    update: {},
    create: {
      code: 'FREESHIP',
      discountType: 'FREE_DELIVERY',
      expiryDate: faker.date.future({ years: 1 }),
      usageLimit: 1000,
    },
  });

  const blogCategory = await prisma.blogCategory.upsert({
    where: { slug: 'guides' },
    update: {},
    create: { name: 'Guides', slug: 'guides' },
  });

  const blogPosts = [
    {
      title: 'How to Choose the Right Sofa for Your Living Room',
      slug: 'choosing-the-right-sofa',
    },
    {
      title: '5 Bedroom Furniture Trends This Year',
      slug: 'bedroom-furniture-trends',
    },
  ];

  for (const post of blogPosts) {
    await prisma.blogPost.upsert({
      where: { slug: post.slug },
      update: {},
      create: {
        title: post.title,
        slug: post.slug,
        content: `<p>${faker.lorem.paragraphs(3, '</p><p>')}</p>`,
        image: placeholderImage(post.slug, 1200, 630),
        published: true,
        categoryId: blogCategory.id,
      },
    });
  }

  const products = await prisma.product.findMany({ take: 4 });
  const existingFlashSale = await prisma.flashSale.findFirst({
    where: { title: 'Weekend Flash Sale' },
  });
  if (!existingFlashSale && products.length) {
    await prisma.flashSale.create({
      data: {
        title: 'Weekend Flash Sale',
        subtitle: 'Up to 20% off selected furniture',
        startDate: faker.date.recent({ days: 1 }),
        endDate: faker.date.soon({ days: 3 }),
        products: {
          create: products.map((p, i) => ({ productId: p.id, sortOrder: i })),
        },
      },
    });
  }
}

export async function seedDemoOrders(prisma: PrismaClient) {
  const customer = await prisma.user.findUnique({
    where: { email: 'demo-customer@sakigai.com' },
  });
  if (!customer) return;

  const district = await prisma.city.findFirst();
  const productSizes = await prisma.productSize.findMany({
    take: 6,
    include: {
      color: { include: { color: true, product: true } },
      size: true,
    },
  });
  if (!productSizes.length) return;

  const orderPlans: {
    suffix: string;
    status: 'DELIVERED' | 'PROCESSING' | 'PENDING';
    paymentStatus: 'PAID' | 'PENDING';
    withReview: boolean;
  }[] = [
    {
      suffix: '0001',
      status: 'DELIVERED',
      paymentStatus: 'PAID',
      withReview: true,
    },
    {
      suffix: '0002',
      status: 'PROCESSING',
      paymentStatus: 'PAID',
      withReview: false,
    },
    {
      suffix: '0003',
      status: 'PENDING',
      paymentStatus: 'PENDING',
      withReview: false,
    },
  ];

  for (const plan of orderPlans) {
    const orderId = `DEMO-ORD-${plan.suffix}`;
    const existing = await prisma.order.findUnique({ where: { orderId } });
    if (existing) continue;

    const line = faker.helpers.arrayElement(productSizes);
    const quantity = faker.number.int({ min: 1, max: 2 });
    const price = line.price ?? line.basePrice ?? 20000;
    const total = price * quantity;

    const order = await prisma.order.create({
      data: {
        orderId,
        trackingToken: faker.string.uuid(),
        userId: customer.id,
        customerName: customer.name ?? 'Demo Customer',
        customerPhone: customer.phone ?? '+8801700000000',
        customerEmail: customer.email,
        shippingAddress: '123 Demo Street, Gulshan',
        districtId: district?.id,
        districtName: district?.name,
        total,
        status: plan.status,
        paymentStatus: plan.paymentStatus,
        items: {
          create: {
            productId: line.color.product.id,
            productTitle: line.color.product.title,
            sku: line.sku,
            color: line.color.color.name,
            size: line.size.name,
            productSizeId: line.id,
            quantity,
            priceAtPurchase: price,
            basePriceAtPurchase: line.basePrice ?? price,
            totalPriceAtPurchase: total,
            isReviewed: plan.withReview,
          },
        },
        orderStatusHistories: {
          create: { status: plan.status },
        },
        payments: {
          create: {
            method: 'COD',
            phase: 'FULL',
            amount: total,
            paidAmount: plan.paymentStatus === 'PAID' ? total : 0,
            transactionId: `DEMO-TXN-${plan.suffix}`,
            status: plan.paymentStatus,
            gateway: 'COD',
          },
        },
      },
      include: { items: true },
    });

    if (plan.withReview && order.items[0]) {
      const existingReview = await prisma.review.findUnique({
        where: { orderItemId: order.items[0].id },
      });
      if (!existingReview) {
        await prisma.review.create({
          data: {
            orderItemId: order.items[0].id,
            rating: 5,
            comment: 'Great quality and fast delivery. Highly recommend!',
          },
        });
      }
    }
  }
}

/** Used by the "Generate Random Category" admin button (demo/dev only). */
export async function generateRandomCategory(prisma: PrismaClient) {
  const series =
    (await prisma.series.findFirst()) ??
    (await prisma.series.create({
      data: { name: 'General', slug: 'general', seriesType: 'NORMAL' },
    }));

  const noun = faker.commerce.department();
  const suffix = faker.string.alphanumeric(4).toUpperCase();
  const categoryName = `${noun} ${suffix}`;
  const category = await prisma.category.create({
    data: {
      name: categoryName,
      slug: slugify(categoryName),
      seriesId: series.id,
    },
  });

  const subCategoryName = `${faker.commerce.productAdjective()} ${noun}`;
  await prisma.subCategory.create({
    data: {
      name: subCategoryName,
      slug: slugify(`${subCategoryName}-${suffix}`),
      categoryId: category.id,
    },
  });

  return category;
}

/** Used by the "Generate Random Blog Post" admin button (demo/dev only). */
export async function generateRandomBlogPost(prisma: PrismaClient) {
  const category =
    (await prisma.blogCategory.findFirst()) ??
    (await prisma.blogCategory.create({
      data: { name: 'Guides', slug: 'guides' },
    }));

  const title = faker.lorem.sentence({ min: 4, max: 8 }).replace(/\.$/, '');
  const slug = `${slugify(title)}-${faker.string.alphanumeric(4).toLowerCase()}`;

  return prisma.blogPost.create({
    data: {
      title,
      slug,
      content: `<p>${faker.lorem.paragraphs(3, '</p><p>')}</p>`,
      image: placeholderImage(slug, 1200, 630),
      published: true,
      categoryId: category.id,
    },
  });
}

/** Used by the "Generate Random Coupon" admin button (demo/dev only). */
export async function generateRandomCoupon(prisma: PrismaClient) {
  const code = `DEMO${faker.string.alphanumeric(6).toUpperCase()}`;
  const isPercentage = faker.datatype.boolean();

  return prisma.coupon.create({
    data: {
      code,
      discountType: isPercentage ? 'PERCENTAGE' : 'FIXED_AMOUNT',
      discountValue: isPercentage
        ? faker.number.int({ min: 5, max: 25 })
        : faker.number.int({ min: 100, max: 1000 }),
      maxDiscount: isPercentage ? 2000 : undefined,
      minOrderValue: faker.number.int({ min: 1000, max: 5000 }),
      expiryDate: faker.date.future({ years: 1 }),
      usageLimit: faker.number.int({ min: 50, max: 500 }),
      perUserLimit: 1,
    },
  });
}

export async function seedDemoData(prisma: PrismaClient) {
  await seedDemoUsers(prisma);
  await seedDemoDistricts(prisma);
  await seedDemoProducts(prisma);
  await seedDemoMarketing(prisma);
  await seedDemoOrders(prisma);
}

export function isDemoMode(): boolean {
  return (
    process.env.RENDER === 'true' || process.env.NODE_ENV === 'development'
  );
}
