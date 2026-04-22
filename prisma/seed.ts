/* eslint-disable @typescript-eslint/no-unused-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { PrismaClient, UserRole } from '@prisma/client';
import { Action } from '../src/permission/action.enum';
import * as bcrypt from 'bcrypt';

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
