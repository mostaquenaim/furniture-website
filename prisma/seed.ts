/* eslint-disable @typescript-eslint/no-unused-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

enum Action {
  UPDATE_BROAD_BANNER = 'UPDATE_BROAD_BANNER',
  CREATE_BROAD_BANNER = 'CREATE_BROAD_BANNER',
  DELETE_BROAD_BANNER = 'DELETE_BROAD_BANNER',
  SEASONAL_CATEGORY_DELETE = 'SEASONAL_CATEGORY_DELETE',
  SEASONAL_CATEGORY_CREATE = 'SEASONAL_CATEGORY_CREATE',
  SEASONAL_CATEGORY_UPDATE = 'SEASONAL_CATEGORY_UPDATE',
  SEASONAL_CATEGORY_REORDER = 'SEASONAL_CATEGORY_REORDER',
  HOMEPAGE_GALLERY_UPDATE = 'HOMEPAGE_GALLERY_UPDATE',
  HOMEPAGE_GALLERY_DELETE = 'HOMEPAGE_GALLERY_DELETE',
  HOMEPAGE_GALLERY_REORDER = 'HOMEPAGE_GALLERY_REORDER',
  HOMEPAGE_GALLERY_CREATE = 'HOMEPAGE_GALLERY_CREATE',
  CATEGORY_VIEW = 'CATEGORY_VIEW',
  CATEGORY_CREATE = 'CATEGORY_CREATE',
  CATEGORY_UPDATE = 'CATEGORY_UPDATE',
  CATEGORY_REORDER = 'CATEGORY_REORDER',
  PRODUCT_VIEW = 'PRODUCT_VIEW',
  PRODUCT_CREATE = 'PRODUCT_CREATE',
  PRODUCT_UPDATE = 'PRODUCT_UPDATE',
  PRODUCT_SYNC = 'PRODUCT_SYNC',
  CMS_VIEW = 'CMS_VIEW',
  CMS_COLOR_MANAGE = 'CMS_COLOR_MANAGE',
  CMS_SIZE_MANAGE = 'CMS_SIZE_MANAGE',
  CMS_VARIANT_MANAGE = 'CMS_VARIANT_MANAGE',
  CMS_MATERIAL_MANAGE = 'CMS_MATERIAL_MANAGE',
  BLOG_CREATE = 'BLOG_CREATE',
  BLOG_CATEGORY_CREATE = 'BLOG_CATEGORY_CREATE',
  ORDER_VIEW = 'ORDER_VIEW',
  ORDER_UPDATE_STATUS = 'ORDER_UPDATE_STATUS',
  COUPON_CREATE = 'COUPON_CREATE',
  COUPON_READ = 'COUPON_READ',
  COUPON_UPDATE = 'COUPON_UPDATE',
  COUPON_DELETE = 'COUPON_DELETE',
  COURIER_VIEW = 'COURIER_VIEW',
  COURIER_MANAGE = 'COURIER_MANAGE',
  DISTRICT_MANAGE = 'DISTRICT_MANAGE',
  BANNER_MANAGE = 'BANNER_MANAGE',
  REVIEW_MANAGE = 'REVIEW_MANAGE',
  TAG_CREATE = 'TAG_CREATE',
  BARCODE_VIEW = 'BARCODE_VIEW',
  BARCODE_CREATE = 'BARCODE_CREATE',
  BARCODE_UPDATE = 'BARCODE_UPDATE',
  LOCATION_VIEW = 'LOCATION_VIEW',
  LOCATION_CREATE = 'LOCATION_CREATE',
  COMPANY_MANAGE = 'COMPANY_MANAGE',
}

const prisma = new PrismaClient();

const MANAGEABLE_ROLES = [
  UserRole.PRODUCTMANAGER,
  UserRole.ORDERMANAGER,
  UserRole.SUPPORT,
];

const DEFAULT_PERMISSIONS: Partial<Record<UserRole, Action[]>> = {
  [UserRole.PRODUCTMANAGER]: [
    Action.CATEGORY_VIEW,
    Action.CATEGORY_CREATE,
    Action.CATEGORY_UPDATE,
    Action.CATEGORY_REORDER,
    Action.PRODUCT_VIEW,
    Action.PRODUCT_CREATE,
    Action.PRODUCT_UPDATE,
    Action.PRODUCT_SYNC,
    Action.CMS_VIEW,
    Action.CMS_COLOR_MANAGE,
    Action.CMS_SIZE_MANAGE,
    Action.CMS_VARIANT_MANAGE,
    Action.CMS_MATERIAL_MANAGE,
    Action.BLOG_CREATE,
    Action.BLOG_CATEGORY_CREATE,
    Action.REVIEW_MANAGE,
    Action.BANNER_MANAGE,
    Action.TAG_CREATE,
    Action.BARCODE_VIEW,
    Action.BARCODE_CREATE,
    Action.BARCODE_UPDATE,
    Action.LOCATION_VIEW,
    Action.LOCATION_CREATE,
  ],

  [UserRole.ORDERMANAGER]: [
    Action.ORDER_VIEW,
    Action.ORDER_UPDATE_STATUS,
    Action.COUPON_CREATE,
    Action.COURIER_VIEW,
    Action.COURIER_MANAGE,
    Action.DISTRICT_MANAGE,
    Action.BARCODE_VIEW,
  ],

  [UserRole.SUPPORT]: [
    Action.ORDER_VIEW,
    Action.REVIEW_MANAGE,
    Action.COURIER_VIEW,
    Action.BARCODE_VIEW,
  ],
};

async function main() {
  const allActions: Action[] = Object.values(Action);
  let created = 0;
  let updated = 0;

  for (const role of MANAGEABLE_ROLES) {
    const defaultsForRole = DEFAULT_PERMISSIONS[role] ?? [];

    for (const action of allActions) {
      const enabled = defaultsForRole.includes(action);

      const result = await prisma.rolePermission.upsert({
        where: { role_action: { role, action } },
        update: { enabled }, // re-running seed resets to defaults
        create: { role, action, enabled },
      });

      result ? created++ : updated++;
    }
  }

  await prisma.companyInfo.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: 'Sakigai',
      email: 'hello@sakigai.com',
      country: 'Bangladesh',
    },
  });

  const adminEmail = 'admin@sakigai.com';
  const adminPassword = process.env.ADMIN_PASSWORD || '@Abcd1234';

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    await prisma.user.create({
      data: {
        email: adminEmail,
        password: hashedPassword,
        role: UserRole.SUPERADMIN,
      },
    });

    console.log('✅ SUPERADMIN created');
  } else {
    console.log('ℹ️ SUPERADMIN already exists');
  }

  await prisma.series.upsert({
    where: { slug: 'sale' },
    update: { seriesType: 'SALE' },
    create: {
      name: 'Sale',
      slug: 'sale',
      seriesType: 'SALE',
      sortOrder: 9999,
      isActive: true,
      categories: {
        create: {
          name: 'All Categories',
          slug: 'sale-all-categories',
          sortOrder: 1,
          isActive: true,
          subCategories: {
            create: {
              name: 'All Sale Items',
              slug: 'sale-all',
              sortOrder: 1,
              isActive: true,
            },
          },
        },
      },
    },
  });

  console.log(
    `Seeded ${MANAGEABLE_ROLES.length * allActions.length} permission rows`,
  );
  console.log(`Actions per role: ${allActions.length}`);
  console.log(`Roles seeded: ${MANAGEABLE_ROLES.join(', ')}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
