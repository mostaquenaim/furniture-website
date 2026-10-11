/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import * as fs from 'fs';
import * as path from 'path';
import pdfmake from 'pdfmake';
import type {
  Content,
  ContentText,
  TableCell,
  TDocumentDefinitions,
} from 'pdfmake/interfaces';

// Invoice PDF rendered with pdfmake (pure JS, no headless browser).
// Mirrors the layout of the old Puppeteer HTML template. Sizes are the old
// CSS px values * 0.75 (px -> pt at 96dpi).

const FONTS_DIR = path.join(__dirname, 'fonts');

const FONT_FILES = [
  'CormorantGaramond-Regular.ttf',
  'CormorantGaramond-Light.ttf',
  'CormorantGaramond-SemiBold.ttf',
  'CormorantGaramond-Italic.ttf',
  'CormorantGaramond-SemiBoldItalic.ttf',
  'DMMono-Regular.ttf',
  'DMMono-Medium.ttf',
  'NotoSansBengali-Regular.ttf',
  'NotoSansBengali-SemiBold.ttf',
];

// Load fonts once into pdfmake's in-memory fs; no disk or network access
// happens per render.
const vfs = (pdfmake as any).virtualfs;
for (const file of FONT_FILES) {
  vfs.writeFileSync(file, fs.readFileSync(path.join(FONTS_DIR, file)));
}

pdfmake.setFonts({
  Cormorant: {
    normal: 'CormorantGaramond-Regular.ttf',
    bold: 'CormorantGaramond-SemiBold.ttf',
    italics: 'CormorantGaramond-Italic.ttf',
    bolditalics: 'CormorantGaramond-SemiBoldItalic.ttf',
  },
  CormorantLight: {
    normal: 'CormorantGaramond-Light.ttf',
    bold: 'CormorantGaramond-Light.ttf',
    italics: 'CormorantGaramond-Light.ttf',
    bolditalics: 'CormorantGaramond-Light.ttf',
  },
  DMMono: {
    normal: 'DMMono-Regular.ttf',
    bold: 'DMMono-Medium.ttf',
    italics: 'DMMono-Regular.ttf',
    bolditalics: 'DMMono-Medium.ttf',
  },
  NotoBengali: {
    normal: 'NotoSansBengali-Regular.ttf',
    bold: 'NotoSansBengali-SemiBold.ttf',
    italics: 'NotoSansBengali-Regular.ttf',
    bolditalics: 'NotoSansBengali-SemiBold.ttf',
  },
});

// Invoices never load images or files; deny everything.
pdfmake.setUrlAccessPolicy(() => false);
pdfmake.setLocalAccessPolicy(() => false);

// pdfmake has no per-glyph font fallback (Chrome does). Split text into runs
// so Bengali characters (incl. the ৳ sign) render in Noto Sans Bengali and
// everything else in the requested Latin font.
const BENGALI_CHAR = new RegExp(
  '[\\u0980-\\u09FF\\u0964\\u0965\\u200C\\u200D]',
);

function withBengali(text: string, font: string): ContentText[] {
  const runs: { text: string; font: string }[] = [];
  for (const ch of String(text ?? '')) {
    const last = runs[runs.length - 1];
    const runFont =
      /\s/.test(ch) && last
        ? last.font
        : BENGALI_CHAR.test(ch)
          ? 'NotoBengali'
          : font;
    if (last && last.font === runFont) {
      last.text += ch;
    } else {
      runs.push({ text: ch, font: runFont });
    }
  }
  return runs;
}

const PAGE_WIDTH = 595.28; // A4
const PAD_X = 36;
const PAGE_MARGIN_Y = 30;

const STATUS_COLORS: Record<
  string,
  { bg: string; color: string; border: string }
> = {
  PAID: { bg: '#f0fdf4', color: '#15803d', border: '#86efac' },
  UNPAID: { bg: '#fffbeb', color: '#b45309', border: '#fcd34d' },
  CANCELLED: { bg: '#fef2f2', color: '#dc2626', border: '#fca5a5' },
  REFUNDED: { bg: '#f8fafc', color: '#64748b', border: '#cbd5e1' },
};

const taka = (n: number): string =>
  `৳ ${Number(n).toLocaleString('en-BD', { minimumFractionDigits: 2 })}`;

const fmtDate = (d: Date | string): string =>
  new Date(d).toLocaleDateString('en-BD', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

const mono = (text: string): ContentText[] => withBengali(text, 'DMMono');

// Single full-width cell used for coloured bands (header, footer).
function band(
  content: Content,
  fillColor: string,
  padY: number,
  topLine?: string,
): Content {
  return {
    table: { widths: ['*'], body: [[{ stack: [content], fillColor }]] },
    layout: {
      hLineWidth: (i) => (i === 0 && topLine ? 0.75 : 0),
      hLineColor: () => topLine ?? fillColor,
      vLineWidth: () => 0,
      paddingLeft: () => PAD_X,
      paddingRight: () => PAD_X,
      paddingTop: () => padY,
      paddingBottom: () => padY,
    },
  };
}

// Rounded status pill. DM Mono is monospaced (600/1000 em), so the label
// width is exact without measuring.
function statusPill(status: string): Content {
  const sc = STATUS_COLORS[status] ?? STATUS_COLORS.UNPAID;
  const label = status.toUpperCase();
  const fontSize = 7.5;
  const spacing = 0.75;
  const padX = 10.5;
  const height = 15;
  const textWidth =
    label.length * fontSize * 0.6 + spacing * (label.length - 1);
  const width = textWidth + padX * 2;

  return {
    columns: [
      { width: '*', text: '' },
      {
        width,
        stack: [
          {
            canvas: [
              {
                type: 'rect',
                x: 0,
                y: 0,
                w: width,
                h: height,
                r: height / 2,
                color: sc.bg,
                lineColor: sc.border,
                lineWidth: 0.75,
              },
            ],
          },
          {
            text: label,
            font: 'DMMono',
            fontSize,
            characterSpacing: spacing,
            color: sc.color,
            alignment: 'center',
            margin: [0, -height + 3.5, 0, 0],
          },
        ],
      },
    ],
    margin: [0, 9, 0, 0],
  };
}

function metaLabel(text: string, marginTop = 0): Content {
  return {
    text: text.toUpperCase(),
    font: 'DMMono',
    fontSize: 6.75,
    characterSpacing: 1.2,
    color: '#94a3b8',
    margin: [0, marginTop, 0, 6],
  };
}

function metaDate(d: Date | string): Content {
  return { text: fmtDate(d), fontSize: 9.75, color: '#0f172a' };
}

// Rendering is CPU-bound on the single Node thread, so running many at once
// doesn't finish sooner — it only stacks up memory. Queue beyond 2.
const MAX_CONCURRENT_RENDERS = 2;
let activeRenders = 0;
const waiting: (() => void)[] = [];

export async function buildInvoicePdf(invoice: any): Promise<Buffer> {
  if (activeRenders >= MAX_CONCURRENT_RENDERS) {
    await new Promise<void>((resolve) => waiting.push(resolve));
  }
  activeRenders++;
  try {
    return await renderInvoicePdf(invoice);
  } finally {
    activeRenders--;
    waiting.shift()?.();
  }
}

function renderInvoicePdf(invoice: any): Promise<Buffer> {
  const user = invoice.order?.user;
  const items: any[] = invoice.order?.items ?? [];
  const status: string = invoice.status ?? 'UNPAID';

  const subtotal = items.reduce(
    (s: number, i: any) => s + i.quantity * i.priceAtPurchase,
    0,
  );

  // ── Header ────────────────────────────────────────────────────────────
  const header = band(
    {
      columns: [
        {
          width: '*',
          stack: [
            {
              text: 'ONDORKOTHA',
              bold: true,
              fontSize: 18,
              characterSpacing: 4.5,
              color: '#e2c97e',
            },
            {
              text: 'FURNITURE · CRAFTED FOR YOUR HOME',
              fontSize: 7.5,
              characterSpacing: 1.5,
              color: '#64748b',
              margin: [0, 3, 0, 0],
            },
            {
              text: 'Dhaka, Bangladesh\nsupport@ondorkotha.com.bd · ondorkotha.com.bd',
              fontSize: 8.25,
              lineHeight: 1.3,
              color: '#475569',
              margin: [0, 12, 0, 0],
            },
          ],
        },
        {
          width: 'auto',
          stack: [
            {
              text: 'INVOICE',
              font: 'CormorantLight',
              fontSize: 24,
              characterSpacing: 7.2,
              color: '#cbd5e1',
              alignment: 'right',
            },
            {
              text: mono(String(invoice.invoiceNo ?? '')),
              fontSize: 9,
              color: '#e2c97e',
              alignment: 'right',
              margin: [0, 4.5, 0, 0],
            },
            statusPill(status),
          ],
        },
      ],
    },
    '#0f172a',
    30,
  );

  const goldRule: Content = {
    canvas: [
      {
        type: 'rect',
        x: 0,
        y: 0,
        w: PAGE_WIDTH,
        h: 2.25,
        linearGradient: ['#e2c97e', '#c9a84c', '#0f172a'],
      },
    ],
  };

  // ── Billed to / Issued / Order ref ───────────────────────────────────────
  const billedTo: Content[] = [
    metaLabel('Billed To'),
    {
      text: withBengali(user?.name ?? '—', 'Cormorant'),
      bold: true,
      fontSize: 10.5,
      color: '#0f172a',
    },
  ];
  if (user?.email) {
    billedTo.push({
      text: user.email,
      fontSize: 8.25,
      color: '#64748b',
      margin: [0, 1.5, 0, 0],
    });
  }
  if (user?.phone) {
    billedTo.push({
      text: mono(user.phone),
      fontSize: 8.25,
      color: '#64748b',
      margin: [0, 1.5, 0, 0],
    });
  }

  const issued: Content[] = [metaLabel('Issued'), metaDate(invoice.issuedAt)];
  if (invoice.dueDate) {
    issued.push(metaLabel('Due', 10.5), metaDate(invoice.dueDate));
  }

  const orderRef: Content[] = [
    metaLabel('Order Ref'),
    {
      text: mono(String(invoice.order?.id ?? '—')),
      fontSize: 8.25,
      color: '#475569',
    },
  ];
  if (invoice.paidAt) {
    orderRef.push(metaLabel('Paid On', 10.5), metaDate(invoice.paidAt));
  }

  const metaRow: Content = {
    table: {
      widths: ['*', '*', '*'],
      body: [[{ stack: billedTo }, { stack: issued }, { stack: orderRef }]],
    },
    layout: {
      hLineWidth: (i) => (i === 1 ? 0.75 : 0),
      hLineColor: () => '#f1f5f9',
      vLineWidth: (i) => (i === 1 || i === 2 ? 0.75 : 0),
      vLineColor: () => '#f1f5f9',
      paddingLeft: () => 24,
      paddingRight: () => 24,
      paddingTop: () => 18,
      paddingBottom: () => 18,
    },
  };

  // ── Items table ─────────────────────────────────────────────────────────
  const th = (text: string, alignment: 'left' | 'center' | 'right') => ({
    text: text.toUpperCase(),
    font: 'DMMono',
    fontSize: 6.75,
    characterSpacing: 1,
    color: '#94a3b8',
    alignment,
  });

  const itemRows: TableCell[][] = items.map((item) => {
    const nameCell: Content[] = [
      {
        text: withBengali(item.productTitle ?? '', 'Cormorant'),
        bold: true,
        fontSize: 10.5,
        color: '#0f172a',
      },
    ];
    if (item.sku) {
      nameCell.push({
        text: mono(`SKU: ${item.sku}`),
        fontSize: 7.5,
        color: '#94a3b8',
        margin: [0, 1.5, 0, 0],
      });
    }
    return [
      { stack: nameCell },
      { text: mono(String(item.quantity)), alignment: 'center' },
      { text: mono(taka(item.priceAtPurchase)), alignment: 'right' },
      {
        text: mono(taka(item.quantity * item.priceAtPurchase)),
        alignment: 'right',
        bold: true,
        color: '#0f172a',
      },
    ];
  });

  const itemsTable: Content = {
    margin: [PAD_X, 24, PAD_X, 18],
    table: {
      headerRows: 1,
      dontBreakRows: true,
      widths: ['44%', '12%', '*', '*'],
      body: [
        [
          th('Item', 'left'),
          th('Qty', 'center'),
          th('Unit Price', 'right'),
          th('Amount', 'right'),
        ],
        ...itemRows,
      ],
    },
    layout: {
      hLineWidth: (i, node) =>
        i <= 1 || i === node.table.body.length ? 1.5 : 0.75,
      hLineColor: (i, node) =>
        i <= 1 || i === node.table.body.length ? '#0f172a' : '#f1f5f9',
      vLineWidth: () => 0,
      paddingLeft: (i) => (i === 0 ? 0 : 6),
      paddingRight: () => 6,
      paddingTop: (i) => (i === 0 ? 8.25 : 10.5),
      paddingBottom: (i) => (i === 0 ? 8.25 : 10.5),
    },
  };

  // ── Totals ──────────────────────────────────────────────────────────────
  const totalsBody: any[][] = [];
  const totalsRow = (label: string, value: string, color = '#64748b') =>
    totalsBody.push([
      { text: label, fontSize: 9, color: '#64748b' },
      { text: mono(value), fontSize: 9, color, alignment: 'right' },
    ]);

  totalsRow('Subtotal', taka(subtotal));
  if ((invoice.discount ?? 0) > 0) {
    totalsRow('Discount', `− ${taka(invoice.discount)}`, '#15803d');
  }
  totalsRow(
    'Shipping',
    (invoice.shippingCost ?? 0) > 0 ? taka(invoice.shippingCost) : 'Free',
  );
  if ((invoice.tax ?? 0) > 0) {
    totalsRow('Tax', taka(invoice.tax));
  }
  totalsBody.push([
    { text: 'Total', bold: true, fontSize: 12.75, color: '#0f172a' },
    {
      text: mono(taka(invoice.total)),
      bold: true,
      fontSize: 11.25,
      color: '#0f172a',
      alignment: 'right',
      margin: [0, 1.5, 0, 0],
    },
  ]);
  const grandRowIndex = totalsBody.length - 1;

  const totals: Content = {
    margin: [PAD_X, 0, PAD_X, 27],
    columns: [
      { width: '*', text: '' },
      {
        width: 165,
        table: { widths: ['*', 'auto'], body: totalsBody },
        layout: {
          hLineWidth: (i) =>
            i === grandRowIndex ? 1.5 : i === 0 || i > grandRowIndex ? 0 : 0.75,
          hLineColor: (i) => (i === grandRowIndex ? '#0f172a' : '#f8fafc'),
          vLineWidth: () => 0,
          paddingLeft: () => 0,
          paddingRight: () => 0,
          paddingTop: (i) => (i === grandRowIndex ? 9 : 4.5),
          paddingBottom: () => 4.5,
        },
      },
    ],
  };

  const thankYou: Content = {
    text: 'Thank you for choosing Ondorkotha. We hope you love your furniture.',
    italics: true,
    fontSize: 9.75,
    color: '#94a3b8',
    alignment: 'center',
    margin: [PAD_X, 15, PAD_X, 21],
  };

  const footer = band(
    {
      columns: [
        {
          width: '*',
          text: 'Questions? Email support@ondorkotha.com.bd\nComputer-generated invoice — no signature required.',
          fontSize: 7.5,
          lineHeight: 1.3,
          color: '#94a3b8',
        },
        {
          width: 'auto',
          text: `ONDORKOTHA · ${new Date().getFullYear()}`,
          font: 'DMMono',
          fontSize: 7.5,
          characterSpacing: 1.9,
          color: '#cbd5e1',
          margin: [0, 4, 0, 0],
        },
      ],
    },
    '#faf9f7',
    15,
    '#f1f5f9',
  );

  const docDefinition: TDocumentDefinitions = {
    pageSize: 'A4',
    // Top/bottom margins keep continuation pages off the paper edge; the
    // first-page header is pulled up into the top margin to stay full-bleed.
    pageMargins: [0, PAGE_MARGIN_Y, 0, PAGE_MARGIN_Y],
    info: { title: `Invoice ${invoice.invoiceNo ?? ''}` },
    defaultStyle: { font: 'Cormorant', fontSize: 9.75, color: '#1e293b' },
    content: [
      { stack: [header], margin: [0, -PAGE_MARGIN_Y, 0, 0] },
      goldRule,
      metaRow,
      itemsTable,
      // Keep totals and the footer together so the footer never lands alone
      // on a trailing page.
      { stack: [totals, thankYou, footer], unbreakable: true },
    ],
  };

  return pdfmake.createPdf(docDefinition).getBuffer();
}
