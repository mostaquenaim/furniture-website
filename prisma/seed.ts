/* eslint-disable @typescript-eslint/no-unused-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { Action } from '../src/permission/action.enum';

const prisma = new PrismaClient();

const MANAGEABLE_ROLES = [
  UserRole.PRODUCTMANAGER,
  UserRole.ORDERMANAGER,
  UserRole.INVENTORYMANAGER,
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
    // Piece-level barcode generation + supplier management (Product Manager
    // "print/generate barcodes, add suppliers"). INVENTORY_VIEW is a
    // pragmatic exception to "no stock access" — the Generate & Print flow
    // does a GET /inventory variant search to find what to generate against.
    Action.PIECE_VIEW,
    Action.PIECE_GENERATE,
    Action.PIECE_VOID,
    Action.SUPPLIER_VIEW,
    Action.SUPPLIER_MANAGE,
    Action.INVENTORY_VIEW,
  ],

  [UserRole.ORDERMANAGER]: [
    Action.ORDER_VIEW,
    Action.ORDER_UPDATE_STATUS,
    Action.COUPON_CREATE,
    Action.COURIER_VIEW,
    Action.COURIER_MANAGE,
    Action.DISTRICT_MANAGE,
    Action.BARCODE_VIEW,
    // Reserve/assign pieces to orders, print pick slip, scan pick-confirm.
    Action.RESERVATION_MANAGE,
    Action.PICK_SLIP_VIEW,
    Action.RESERVATION_PICK_CONFIRM,
  ],

  [UserRole.INVENTORYMANAGER]: [
    // Scan/receive barcodes, set shelf location, confirm returns.
    Action.PIECE_VIEW,
    Action.PIECE_RECEIVE,
    Action.PIECE_LOCATION_ASSIGN,
    Action.RETURN_RECEIVE_SCAN,
    Action.SUPPLIER_VIEW,
    Action.DASHBOARD_SHELF_MAP_VIEW,
    Action.DASHBOARD_DAMAGE_REPORT_VIEW,
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
