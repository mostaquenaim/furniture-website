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

const EMAIL_TEMPLATES: {
  key: string;
  name: string;
  subject: string;
  body: string;
}[] = [
  {
    key: 'order-confirmation',
    name: 'Order Confirmation',
    subject: 'Order #{{orderId}} Confirmed',
    body: `<div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px;">
  <h2 style="color: #333;">Thank you for your order, {{customerName}}!</h2>
  <p>We've received your order <strong>#{{orderId}}</strong> and are getting it ready for shipment.</p>

  <div style="background-color: #f9f9f9; padding: 15px; margin-bottom: 20px;">
    <h3 style="margin-top: 0;">Order Summary</h3>
    <p><strong>Tracking Token:</strong> {{trackingToken}}</p>
    <p><strong>Shipping to:</strong><br>
       {{customerName}}<br>
       {{shippingAddress}}<br>
       {{districtName}}, {{postCode}}</p>
  </div>

  <table style="width: 100%; border-collapse: collapse;">
    <thead>
      <tr style="border-bottom: 2px solid #eee;">
        <th style="text-align: left; padding: 10px 0;">Product</th>
        <th style="text-align: center;">Qty</th>
        <th style="text-align: right;">Price</th>
      </tr>
    </thead>
    <tbody>
      {{#each items}}
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 10px 0;">
          <strong>{{this.productTitle}}</strong><br>
          <small>Size: {{this.size}} | Color: {{this.color}}</small>
        </td>
        <td style="text-align: center;">{{this.quantity}}</td>
        <td style="text-align: right;">৳{{this.priceAtPurchase}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>

  <div style="text-align: right; margin-top: 20px;">
    <p>Subtotal: ৳{{subtotal}}</p>
    <p>Delivery Charge: ৳{{deliveryCharge}}</p>
    <h3 style="color: #e67e22;">Total: ৳{{total}}</h3>
  </div>

  <p style="font-size: 12px; color: #777; margin-top: 40px;">
    If you have any questions, contact us at support@ondorkotha.com.
  </p>
</div>`,
  },
  {
    key: 'order-status-update',
    name: 'Order Status Update',
    subject: 'Order #{{orderId}} is now {{status}}',
    body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eaeaea; padding: 24px; background-color: #ffffff;">

  <div style="text-align:center; margin-bottom: 20px;">
    <h1 style="margin:0; color:#222;">Sakigai</h1>
    <p style="margin:0; font-size:14px; color:#777;">Order Update</p>
  </div>

  <h2 style="color:#333;">Hello {{customerName}},</h2>

  <p>
    Your order <strong>#{{orderId}}</strong> has been updated.
  </p>

  <div style="
    margin: 25px 0;
    padding: 15px;
    background-color: #f7f7f7;
    border-left: 5px solid #e67e22;
  ">
    <p style="margin:0; font-size:16px;">
      Current Status: <strong>{{status}}</strong>
    </p>
  </div>

  {{#if trackingToken}}
  <div style="text-align:center; margin: 25px 0;">
    <a href="https://yourdomain.com/track/{{trackingToken}}"
       style="background-color:#e67e22; color:#ffffff; padding:12px 20px; text-decoration:none; border-radius:4px; font-weight:bold;">
       Track Your Order
    </a>
  </div>
  {{/if}}

  <p>
    If you have any questions, feel free to contact our support team.
  </p>

  <hr style="margin:30px 0; border:none; border-top:1px solid #eee;" />

  <p style="font-size:12px; color:#999;">
    Thank you for shopping with Sakigai.
  </p>

</div>`,
  },
  {
    key: 'refund-update',
    name: 'Refund Processed',
    subject: 'Refund processed for order #{{orderId}}',
    body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eaeaea; padding: 24px; background-color: #ffffff;">

  <div style="text-align:center; margin-bottom: 20px;">
    <h1 style="margin:0; color:#222;">Sakigai</h1>
    <p style="margin:0; font-size:14px; color:#777;">Refund Processed</p>
  </div>

  <h2 style="color:#333;">Hello {{customerName}},</h2>

  <p>
    Your refund for order <strong>#{{orderId}}</strong> has been processed.
  </p>

  <div style="
    margin: 25px 0;
    padding: 15px;
    background-color: #f0fdf4;
    border-left: 5px solid #15803d;
  ">
    <p style="margin:0; font-size:16px;">
      Refund Amount: <strong>৳{{amount}}</strong>
    </p>
  </div>

  <p>
    Depending on your bank or mobile wallet, it may take a few business days to reflect.
  </p>

  <hr style="margin:30px 0; border:none; border-top:1px solid #eee;" />

  <p style="font-size:12px; color:#999;">
    Thank you for shopping with Sakigai.
  </p>

</div>`,
  },
  ...(
    [
      {
        event: 'submitted',
        subject: 'Return request received for order #{{orderId}}',
        line: "we've received your return request. We'll review it shortly.",
      },
      {
        event: 'approved',
        subject: 'Return request approved for order #{{orderId}}',
        line: 'your return request has been approved. Please send the item(s) back to us.',
      },
      {
        event: 'rejected',
        subject: 'Return request update for order #{{orderId}}',
        line: 'your return request could not be approved. Please contact support for details.',
      },
      {
        event: 'item-received',
        subject: "We've received your returned item(s) for order #{{orderId}}",
        line: "we've received your returned item(s). Your refund will be processed shortly.",
      },
    ] as const
  ).map(({ event, subject, line }) => ({
    key: `return-request-${event}`,
    name: `Return Request — ${event
      .split('-')
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(' ')}`,
    subject,
    body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eaeaea; padding: 24px; background-color: #ffffff;">

  <div style="text-align:center; margin-bottom: 20px;">
    <h1 style="margin:0; color:#222;">Sakigai</h1>
    <p style="margin:0; font-size:14px; color:#777;">Return Request Update</p>
  </div>

  <h2 style="color:#333;">Hello {{customerName}},</h2>

  <div style="
    margin: 25px 0;
    padding: 15px;
    background-color: #f7f7f7;
    border-left: 5px solid #e67e22;
  ">
    <p style="margin:0; font-size:16px;">
      For order <strong>#{{orderId}}</strong>, ${line}
    </p>
  </div>

  <p>
    If you have any questions, feel free to contact our support team.
  </p>

  <hr style="margin:30px 0; border:none; border-top:1px solid #eee;" />

  <p style="font-size:12px; color:#999;">
    Thank you for shopping with Sakigai.
  </p>

</div>`,
  })),
  {
    key: 'ticket-reply',
    name: 'Support Ticket Reply',
    subject: 'New reply on your support ticket #{{ticketId}}',
    body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eaeaea; padding: 24px; background-color: #ffffff;">

  <div style="text-align:center; margin-bottom: 20px;">
    <h1 style="margin:0; color:#222;">Sakigai</h1>
    <p style="margin:0; font-size:14px; color:#777;">Support Ticket Reply</p>
  </div>

  <h2 style="color:#333;">Hello {{customerName}},</h2>

  <p style="margin:0 0 10px; font-size:16px;">
    You have a new reply on your support ticket <strong>#{{ticketId}}: {{subject}}</strong>.
  </p>

  <div style="
    margin: 25px 0;
    padding: 15px;
    background-color: #f7f7f7;
    border-left: 5px solid #e67e22;
  ">
    <p style="margin:0; font-size:16px; white-space: pre-wrap;">{{replyPreview}}</p>
  </div>

  <div style="text-align:center; margin: 25px 0;">
    <a href="{{ticketUrl}}" style="
      display:inline-block;
      padding: 12px 24px;
      background-color: #222;
      color: #ffffff;
      text-decoration: none;
      border-radius: 4px;
      font-size: 15px;
    ">View Ticket</a>
  </div>

  <p>
    If you have any questions, feel free to reply directly on the ticket.
  </p>

  <hr style="margin:30px 0; border:none; border-top:1px solid #eee;" />

  <p style="font-size:12px; color:#999;">
    Thank you for shopping with Sakigai.
  </p>

</div>`,
  },
  {
    key: 'offer',
    name: 'Promotional Offer',
    subject: '{{heading}}',
    body: `<div style="font-family: Arial, sans-serif; max-width: 640px; margin: auto; border: 1px solid #eaeaea; padding: 24px; background-color: #ffffff;">

  <div style="text-align:center; margin-bottom: 20px;">
    <h1 style="margin:0; color:#222;">Ondorkotha</h1>
  </div>

  <h2 style="color:#333; margin-bottom: 4px;">{{heading}}</h2>
  <p style="color:#555; line-height: 1.6;">Hi {{customerName}},</p>
  <p style="color:#555; line-height: 1.6;">{{message}}</p>

  {{#if ctaUrl}}
  <div style="text-align:center; margin: 30px 0;">
    <a href="{{ctaUrl}}"
       style="background-color:#e67e22; color:#ffffff; padding:12px 24px; text-decoration:none; border-radius:4px; font-weight:bold;">
       {{ctaLabel}}
    </a>
  </div>
  {{/if}}

  <hr style="margin:30px 0; border:none; border-top:1px solid #eee;" />

  <p style="font-size: 12px; color: #999;">
    You're receiving this email because you have an account with Ondorkotha. If you have any questions, contact us at support@ondorkotha.com.
  </p>
</div>`,
  },
  {
    key: 'low-stock-alert',
    name: 'Low Stock Alert (Admin)',
    subject:
      'Stock Alert: {{outOfStock.length}} out of stock, {{lowStock.length}} low on stock',
    body: `<div style="font-family: Arial, sans-serif; max-width: 640px; margin: auto; border: 1px solid #eaeaea; padding: 24px; background-color: #ffffff;">

  <div style="text-align:center; margin-bottom: 20px;">
    <h1 style="margin:0; color:#222;">Sakigai</h1>
    <p style="margin:0; font-size:14px; color:#777;">Inventory Alert</p>
  </div>

  <h2 style="color:#333; margin-bottom: 4px;">Daily Stock Alert</h2>
  <p style="color:#777; font-size:13px; margin-top:0;">Generated on {{generatedAt}}</p>

  {{#if outOfStock.length}}
  <div style="margin: 25px 0;">
    <h3 style="color:#c0392b; border-bottom: 2px solid #c0392b; padding-bottom: 6px;">
      Out of Stock ({{outOfStock.length}})
    </h3>
    <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
      <thead>
        <tr style="border-bottom: 1px solid #eee; text-align:left;">
          <th style="padding: 8px 4px;">Product</th>
          <th style="padding: 8px 4px;">SKU</th>
          <th style="padding: 8px 4px; text-align:center;">Qty</th>
          <th style="padding: 8px 4px; text-align:center;">Threshold</th>
        </tr>
      </thead>
      <tbody>
        {{#each outOfStock}}
        <tr style="border-bottom: 1px solid #f3f3f3;">
          <td style="padding: 8px 4px;">
            <strong>{{this.productTitle}}</strong><br>
            <small style="color:#777;">{{this.color}} / {{this.size}}</small>
          </td>
          <td style="padding: 8px 4px;">{{this.sku}}</td>
          <td style="padding: 8px 4px; text-align:center; color:#c0392b; font-weight:bold;">{{this.quantity}}</td>
          <td style="padding: 8px 4px; text-align:center;">{{this.lowStockAt}}</td>
        </tr>
        {{/each}}
      </tbody>
    </table>
  </div>
  {{/if}}

  {{#if lowStock.length}}
  <div style="margin: 25px 0;">
    <h3 style="color:#e67e22; border-bottom: 2px solid #e67e22; padding-bottom: 6px;">
      Low Stock ({{lowStock.length}})
    </h3>
    <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
      <thead>
        <tr style="border-bottom: 1px solid #eee; text-align:left;">
          <th style="padding: 8px 4px;">Product</th>
          <th style="padding: 8px 4px;">SKU</th>
          <th style="padding: 8px 4px; text-align:center;">Qty</th>
          <th style="padding: 8px 4px; text-align:center;">Threshold</th>
        </tr>
      </thead>
      <tbody>
        {{#each lowStock}}
        <tr style="border-bottom: 1px solid #f3f3f3;">
          <td style="padding: 8px 4px;">
            <strong>{{this.productTitle}}</strong><br>
            <small style="color:#777;">{{this.color}} / {{this.size}}</small>
          </td>
          <td style="padding: 8px 4px;">{{this.sku}}</td>
          <td style="padding: 8px 4px; text-align:center; color:#e67e22; font-weight:bold;">{{this.quantity}}</td>
          <td style="padding: 8px 4px; text-align:center;">{{this.lowStockAt}}</td>
        </tr>
        {{/each}}
      </tbody>
    </table>
  </div>
  {{/if}}

  <div style="text-align:center; margin: 30px 0;">
    <a href="{{dashboardUrl}}"
       style="background-color:#222; color:#ffffff; padding:12px 20px; text-decoration:none; border-radius:4px; font-weight:bold;">
       View Inventory Dashboard
    </a>
  </div>

  <hr style="margin:30px 0; border:none; border-top:1px solid #eee;" />

  <p style="font-size:12px; color:#999;">
    You're receiving this because your role has inventory access on the Sakigai admin panel.
  </p>

</div>`,
  },
  {
    key: 'stale-pieces-alert',
    name: 'Stale Barcode Batches Alert (Admin)',
    subject:
      '{{items.length}} barcode batch(es) still unreceived after {{thresholdDays}}+ days',
    body: `<div style="font-family: Arial, sans-serif; max-width: 640px; margin: auto; border: 1px solid #eaeaea; padding: 24px; background-color: #ffffff;">

  <div style="text-align:center; margin-bottom: 20px;">
    <h1 style="margin:0; color:#222;">Sakigai</h1>
    <p style="margin:0; font-size:14px; color:#777;">Barcode Inventory Alert</p>
  </div>

  <h2 style="color:#333; margin-bottom: 4px;">Stale Barcode Batches</h2>
  <p style="color:#777; font-size:13px; margin-top:0;">
    Generated on {{generatedAt}} — batches with barcodes still unreceived {{thresholdDays}}+ days after printing.
  </p>

  {{#if items.length}}
  <div style="margin: 25px 0;">
    <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
      <thead>
        <tr style="border-bottom: 1px solid #eee; text-align:left;">
          <th style="padding: 8px 4px;">Product</th>
          <th style="padding: 8px 4px;">Batch</th>
          <th style="padding: 8px 4px; text-align:center;">Requested</th>
          <th style="padding: 8px 4px; text-align:center;">Still pending</th>
          <th style="padding: 8px 4px; text-align:center;">Age (days)</th>
        </tr>
      </thead>
      <tbody>
        {{#each items}}
        <tr style="border-bottom: 1px solid #f3f3f3;">
          <td style="padding: 8px 4px;">
            <strong>{{this.productTitle}}</strong><br>
            <small style="color:#777;">{{this.color}} / {{this.size}}</small>
          </td>
          <td style="padding: 8px 4px; font-family: monospace; font-size:11px; color:#777;">{{this.batchId}}</td>
          <td style="padding: 8px 4px; text-align:center;">{{this.quantity}}</td>
          <td style="padding: 8px 4px; text-align:center; color:#d68910; font-weight:bold;">{{this.pending}}</td>
          <td style="padding: 8px 4px; text-align:center;">{{this.ageDays}}</td>
        </tr>
        {{/each}}
      </tbody>
    </table>
  </div>
  {{/if}}

  <p style="font-size:13px; color:#555;">
    These barcodes were never counted as in-stock, so this doesn't affect what customers see — it's a reminder to
    either receive the physical pieces or void the barcodes if the shipment came up short.
  </p>

  <div style="text-align:center; margin: 30px 0;">
    <a href="{{dashboardUrl}}"
       style="background-color:#222; color:#ffffff; padding:12px 20px; text-decoration:none; border-radius:4px; font-weight:bold;">
       Open Barcode Inventory
    </a>
  </div>

  <hr style="margin:30px 0; border:none; border-top:1px solid #eee;" />

  <p style="font-size:12px; color:#999;">
    You're receiving this because your role has barcode inventory access on the Sakigai admin panel.
  </p>

</div>`,
  },
  {
    key: 'pick-slip',
    name: 'Pick Slip (Warehouse)',
    subject: 'Pick Slip — {{orderId}}',
    body: `<div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px;">
  <h2 style="color: #333;">Pick Slip — #{{orderId}}</h2>
  <p>Reserved pieces to pick from the warehouse for this order.</p>

  <table style="width: 100%; border-collapse: collapse;">
    <thead>
      <tr style="border-bottom: 2px solid #eee;">
        <th style="text-align: left; padding: 10px 0;">Barcode</th>
        <th style="text-align: left;">Product</th>
        <th style="text-align: left;">Shelf</th>
      </tr>
    </thead>
    <tbody>
      {{#each lines}}
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 10px 0; font-family: monospace;">{{this.barcodeValue}}</td>
        <td>
          <strong>{{this.productTitle}}</strong><br>
          <small>{{this.color}} / {{this.size}}</small>
        </td>
        <td>{{this.locationCode}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>
</div>`,
  },
];

// Footer links that pointed at Anthropologie-template leftovers with no real
// feature behind them (AnthroPerks, Registry, Careers, ...) now resolve to
// these placeholder StaticPage rows via /pages/{slug} instead of href="#".
const FOOTER_STATIC_PAGES: { slug: string; title: string; content: string }[] =
  [
    {
      slug: 'return-policy',
      title: 'Returns & Exchanges',
      content:
        '<p>Details on how returns and exchanges work will be published here soon. In the meantime, start a return from your order history or contact support.</p>',
    },
    {
      slug: 'gift-card-balance',
      title: 'Check Gift Card Balance',
      content:
        "<p>We don't currently offer gift cards. Check back here if that changes.</p>",
    },
    {
      slug: 'diversity-inclusion',
      title: 'Diversity & Inclusion',
      content: '<p>Our diversity & inclusion commitments will be shared here soon.</p>',
    },
    {
      slug: 'careers',
      title: 'Careers',
      content:
        "<p>We're not listing open roles here yet. Check back soon, or reach out via our contact page.</p>",
    },
    {
      slug: 'our-impact',
      title: 'Our Impact',
      content: '<p>Details on our community and sustainability impact will be published here soon.</p>',
    },
    {
      slug: 'styling-services',
      title: 'Styling Services',
      content: "<p>We don't currently offer styling services. Check back here if that changes.</p>",
    },
    {
      slug: 'gift-cards',
      title: 'Gift Cards',
      content: "<p>We don't currently offer gift cards. Check back here if that changes.</p>",
    },
    {
      slug: 'registry',
      title: 'Registry',
      content: "<p>We don't currently offer a gift registry. Check back here if that changes.</p>",
    },
    {
      slug: 'design-services',
      title: 'Free Design Services & Guides',
      content: '<p>Our free design services and guides will be published here soon.</p>',
    },
    {
      slug: 'events',
      title: 'Events',
      content: "<p>We don't have any upcoming events listed right now. Check back soon.</p>",
    },
    {
      slug: 'store-locator',
      title: 'Store Locator',
      content: '<p>Store location details will be published here soon.</p>',
    },
    {
      slug: 'rewards',
      title: 'Rewards',
      content: "<p>We don't currently offer a rewards program. Check back here if that changes.</p>",
    },
    {
      slug: 'sms-signup',
      title: 'Sign Up For Texts',
      content: '<p>SMS updates sign-up will be available here soon.</p>',
    },
    {
      slug: 'mobile-app',
      title: 'Mobile App',
      content: "<p>We don't have a mobile app yet. Check back here if that changes.</p>",
    },
  ];

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

  for (const tpl of EMAIL_TEMPLATES) {
    await prisma.emailTemplate.upsert({
      where: { key: tpl.key },
      update: {}, // don't overwrite admin edits on re-seed
      create: {
        key: tpl.key,
        name: tpl.name,
        subject: tpl.subject,
        body: tpl.body,
      },
    });
  }
  console.log(`Seeded ${EMAIL_TEMPLATES.length} email templates`);

  for (const page of FOOTER_STATIC_PAGES) {
    await prisma.staticPage.upsert({
      where: { slug: page.slug },
      update: {}, // don't overwrite admin edits on re-seed
      create: {
        slug: page.slug,
        title: page.title,
        content: page.content,
      },
    });
  }
  console.log(`Seeded ${FOOTER_STATIC_PAGES.length} footer placeholder pages`);

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
