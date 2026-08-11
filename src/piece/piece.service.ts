// src/piece/piece.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  PieceStatus,
  ProductTrackingMode,
  StockAdjustReason,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StockLedgerService } from '../inventory/stock-ledger.service';
import { StockEventsGateway } from '../realtime/stock-events.gateway';
import { BarcodeService } from '../barcode/barcode.service';
import { ActivityLogService } from 'src/activity-log/activity-log.service';
import {
  AssignPieceLocationDto,
  GeneratePiecesDto,
  ReceiveBatchDto,
  ReceiveOutcome,
  ReceivePieceDto,
  VoidPiecesDto,
} from './dto/piece.dto';

// A CREATED piece older than this with no receipt/void is considered stale
// and surfaced by StalePieceAlertService.
export const STALE_PIECE_DAYS = 7;

const PIECE_INCLUDE = {
  productSize: {
    include: {
      size: true,
      color: {
        include: {
          color: true,
          product: { select: { id: true, title: true, slug: true, sku: true } },
        },
      },
    },
  },
  supplier: true,
  location: true,
} satisfies Prisma.PieceInclude;

type PieceWithRelations = Prisma.PieceGetPayload<{ include: typeof PIECE_INCLUDE }>;

@Injectable()
export class PieceService {
  constructor(
    private prisma: PrismaService,
    private stockLedgerService: StockLedgerService,
    private stockEventsGateway: StockEventsGateway,
    private barcodeService: BarcodeService,
    private activityLogService: ActivityLogService,
  ) {}

  // ── Barcode value generation ──────────────────────────────────────────────
  // Backed by a Postgres sequence (see migration `add_piece_barcode_sequence`)
  // rather than `COUNT(*) + i` — piece generation now runs on every product
  // creation, not just the occasional manual "Generate & Print" action, so
  // it needs to be race-safe under concurrent transactions.
  private async nextBarcodeValues(
    tx: Prisma.TransactionClient,
    count: number,
  ): Promise<string[]> {
    if (count <= 0) return [];
    const rows = await tx.$queryRaw<{ v: bigint }[]>`
      SELECT nextval('piece_barcode_seq') AS v FROM generate_series(1, ${count})
    `;
    return rows.map((row) => `PC-${String(row.v).padStart(8, '0')}`);
  }

  // ── Product Manager: generate N pieces for a ProductSize ───────────────────
  async generatePieces(
    dto: GeneratePiecesDto,
    adminId: number,
    actorRole?: UserRole,
  ): Promise<{ batchId: string; pieces: PieceWithRelations[] }> {
    const productSize = await this.prisma.productSize.findUnique({
      where: { id: dto.productSizeId },
      include: {
        color: { include: { product: { select: { id: true, title: true } } } },
      },
    });
    if (!productSize) {
      throw new NotFoundException(
        `Product size #${dto.productSizeId} not found`,
      );
    }

    const { batchId, pieces } = await this.prisma.$transaction((tx) =>
      this.runGeneratePieces(
        tx,
        dto,
        productSize.trackingMode,
        adminId,
        actorRole,
      ),
    );

    await this.activityLogService.log({
      adminId,
      action: 'GENERATE_PIECES',
      module: 'INVENTORY',
      targetId: dto.productSizeId,
      targetLabel: productSize.color.product.title,
      newValue: { quantity: dto.quantity, batchId },
    });

    return { batchId, pieces };
  }

  // Shared core used both by the standalone "Generate & Print" action above
  // and by ProductService (product creation/edit), which needs piece
  // generation to happen inside its own product-creation transaction.
  private async runGeneratePieces(
    tx: Prisma.TransactionClient,
    dto: { productSizeId: number; quantity: number },
    currentTrackingMode: ProductTrackingMode,
    adminId: number,
    actorRole?: UserRole,
  ): Promise<{ batchId: string; pieces: PieceWithRelations[] }> {
    const batch = await tx.generationBatch.create({
      data: {
        productSizeId: dto.productSizeId,
        quantity: dto.quantity,
        createdByUserId: adminId,
      },
    });

    const barcodeValues = await this.nextBarcodeValues(tx, dto.quantity);

    const created = await Promise.all(
      barcodeValues.map((barcodeValue) =>
        tx.piece.create({
          data: {
            barcodeValue,
            productSizeId: dto.productSizeId,
            status: PieceStatus.CREATED,
            generateBatchId: batch.id,
          },
          include: PIECE_INCLUDE,
        }),
      ),
    );

    await tx.pieceStatusEvent.createMany({
      data: created.map((p) => ({
        pieceId: p.id,
        fromStatus: null,
        toStatus: PieceStatus.CREATED,
        actorUserId: adminId,
        actorRole,
        source: 'SYSTEM',
      })),
    });

    // Generating pieces is the deliberate, staff-triggered action that
    // moves this variant onto piece-level tracking (see migration plan —
    // legacy variants opt in by generating pieces + re-stickering).
    if (currentTrackingMode !== ProductTrackingMode.PIECE_BARCODE) {
      await tx.productSize.update({
        where: { id: dto.productSizeId },
        data: { trackingMode: ProductTrackingMode.PIECE_BARCODE },
      });
    }

    return { batchId: batch.id, pieces: created };
  }

  // Used by ProductService when creating a brand-new ProductSize row (or a
  // new row added during a structural product edit): the row always starts
  // at the schema default (LEGACY_QUANTITY) since it was just created in the
  // same transaction, so there's no need to re-fetch it to learn that.
  async generatePiecesForNewSize(
    tx: Prisma.TransactionClient,
    params: { productSizeId: number; quantity: number },
    adminId: number,
    actorRole?: UserRole,
  ): Promise<{ batchId: string; pieces: PieceWithRelations[] }> {
    return this.runGeneratePieces(
      tx,
      params,
      ProductTrackingMode.LEGACY_QUANTITY,
      adminId,
      actorRole,
    );
  }

  // ── Listing ──────────────────────────────────────────────────────────────
  async getPieces(productSizeId?: number, status?: PieceStatus) {
    return this.prisma.piece.findMany({
      where: {
        ...(productSizeId ? { productSizeId } : {}),
        ...(status ? { status } : {}),
      },
      include: PIECE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  private async findByBarcodeOrThrow(
    barcodeValue: string,
  ): Promise<PieceWithRelations> {
    const piece = await this.prisma.piece.findUnique({
      where: { barcodeValue },
      include: PIECE_INCLUDE,
    });
    if (!piece) {
      throw new NotFoundException(`No piece found for barcode ${barcodeValue}`);
    }
    return piece;
  }

  // ── General lookup by barcode, any status (used by the location-assign scan) ─
  async getByBarcode(barcodeValue: string) {
    return this.findByBarcodeOrThrow(barcodeValue);
  }

  // ── Inventory Manager: receive lookup ───────────────────────────────────────
  async receiveLookup(barcodeValue: string) {
    const piece = await this.findByBarcodeOrThrow(barcodeValue);
    if (piece.status !== PieceStatus.CREATED) {
      throw new BadRequestException(
        `Barcode ${barcodeValue} is not awaiting receipt (current status: ${piece.status})`,
      );
    }
    return piece;
  }

  // ── Inventory Manager: receive one piece ────────────────────────────────────
  async receiveOne(
    piece: PieceWithRelations,
    outcome: ReceiveOutcome,
    supplierId: number | undefined,
    adminId: number,
    receiveBatchId?: string,
    actorRole?: UserRole,
  ) {
    if (piece.status !== PieceStatus.CREATED) {
      throw new BadRequestException(
        `Barcode ${piece.barcodeValue} is not awaiting receipt (current status: ${piece.status})`,
      );
    }

    const toStatus =
      outcome === ReceiveOutcome.GOOD
        ? PieceStatus.IN_STOCK
        : PieceStatus.DAMAGED_INCOMING;

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.piece.updateMany({
        where: { id: piece.id, status: PieceStatus.CREATED },
        data: { status: toStatus, supplierId, receiveBatchId },
      });
      if (updated.count === 0) {
        throw new BadRequestException(
          `Barcode ${piece.barcodeValue} was already processed by another request`,
        );
      }

      await tx.pieceStatusEvent.create({
        data: {
          pieceId: piece.id,
          fromStatus: PieceStatus.CREATED,
          toStatus,
          actorUserId: adminId,
          actorRole,
          source: 'SCAN',
        },
      });

      if (outcome === ReceiveOutcome.GOOD) {
        const adjustment = await this.stockLedgerService.recordAdjustment(tx, {
          productSizeId: piece.productSizeId,
          productId: piece.productSize.color.productId,
          delta: 1,
          reason: StockAdjustReason.RESTOCK,
          note: `Received via piece barcode ${piece.barcodeValue}`,
          adminId,
          productLabel: piece.productSize.color.product.title,
        });
        return { toStatus, adjustment };
      }

      return { toStatus, adjustment: null };
    });

    if (result.adjustment) {
      this.stockEventsGateway.emitStockUpdated({
        productSizeId: piece.productSizeId,
        productId: piece.productSize.color.productId,
        quantity: result.adjustment.quantityAfter,
        lowStockAt: result.adjustment.lowStockAt,
      });
    }

    return this.findByBarcodeOrThrow(piece.barcodeValue);
  }

  async receive(dto: ReceivePieceDto, adminId: number, actorRole?: UserRole) {
    const piece = await this.findByBarcodeOrThrow(dto.barcodeValue);
    return this.receiveOne(
      piece,
      dto.outcome,
      dto.supplierId,
      adminId,
      undefined,
      actorRole,
    );
  }

  // ── Inventory Manager: receive a batch (one scan session) ──────────────────
  async receiveBatch(
    dto: ReceiveBatchDto,
    adminId: number,
    actorRole?: UserRole,
  ) {
    const receiveBatchId = crypto.randomUUID();
    const succeeded: PieceWithRelations[] = [];
    const failed: { barcodeValue: string; error: string }[] = [];

    for (const barcodeValue of dto.barcodeValues) {
      try {
        const piece = await this.findByBarcodeOrThrow(barcodeValue);
        const result = await this.receiveOne(
          piece,
          dto.outcome,
          dto.supplierId,
          adminId,
          receiveBatchId,
          actorRole,
        );
        succeeded.push(result);
      } catch (err) {
        failed.push({
          barcodeValue,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return { receiveBatchId, succeeded, failed };
  }

  // ── Admin: reconciliation for one print run — expected vs. what actually
  // happened to those barcodes so far (received, still pending, voided) ──────
  async getBatchReconciliation(batchId: string) {
    const batch = await this.prisma.generationBatch.findUnique({
      where: { id: batchId },
    });
    if (!batch) {
      throw new NotFoundException(`Generation batch ${batchId} not found`);
    }

    const counts = await this.prisma.piece.groupBy({
      by: ['status'],
      where: { generateBatchId: batchId },
      _count: { _all: true },
    });
    const byStatus: Record<string, number> = {};
    for (const c of counts) byStatus[c.status] = c._count._all;

    const received =
      (byStatus[PieceStatus.IN_STOCK] ?? 0) +
      (byStatus[PieceStatus.DAMAGED_INCOMING] ?? 0);
    const pending = byStatus[PieceStatus.CREATED] ?? 0;
    const voided = byStatus[PieceStatus.VOID] ?? 0;

    return {
      batchId: batch.id,
      productSizeId: batch.productSizeId,
      quantity: batch.quantity,
      received,
      pending,
      voided,
      createdAt: batch.createdAt,
    };
  }

  // ── Admin: batches that still have unreceived pieces sitting in CREATED ────
  async listOpenBatches(productSizeId?: number) {
    const batches = await this.prisma.generationBatch.findMany({
      where: { ...(productSizeId ? { productSizeId } : {}) },
      include: {
        productSize: {
          include: {
            size: true,
            color: {
              include: {
                color: true,
                product: { select: { id: true, title: true } },
              },
            },
          },
        },
        pieces: { select: { status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return batches
      .map((b) => {
        const pending = b.pieces.filter(
          (p) => p.status === PieceStatus.CREATED,
        ).length;
        const received = b.pieces.filter(
          (p) =>
            p.status === PieceStatus.IN_STOCK ||
            p.status === PieceStatus.DAMAGED_INCOMING,
        ).length;
        const voided = b.pieces.filter(
          (p) => p.status === PieceStatus.VOID,
        ).length;
        return {
          batchId: b.id,
          productSizeId: b.productSizeId,
          productTitle: b.productSize.color.product.title,
          color: b.productSize.color.color.name,
          size: b.productSize.size.name,
          quantity: b.quantity,
          received,
          pending,
          voided,
          createdAt: b.createdAt,
        };
      })
      .filter((b) => b.pending > 0);
  }

  // ── Admin: open batches whose CREATED pieces have sat unreceived past the
  // stale threshold — same shape as listOpenBatches() plus ageDays ─────────
  async getStaleBatches(thresholdDays: number = STALE_PIECE_DAYS) {
    const cutoffMs = thresholdDays * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const open = await this.listOpenBatches();
    return open
      .filter((b) => now - b.createdAt.getTime() >= cutoffMs)
      .map((b) => ({
        ...b,
        ageDays: Math.floor((now - b.createdAt.getTime()) / (24 * 60 * 60 * 1000)),
      }));
  }

  // ── Admin: void unused CREATED barcodes (overprint cleanup) ────────────────
  // Only ever transitions CREATED -> VOID, so it never touches
  // StockLedgerService — these pieces were never counted as stock.
  async voidPieces(dto: VoidPiecesDto, adminId: number, actorRole?: UserRole) {
    const succeeded: PieceWithRelations[] = [];
    const failed: { barcodeValue: string; error: string }[] = [];

    for (const barcodeValue of dto.barcodeValues) {
      try {
        const piece = await this.findByBarcodeOrThrow(barcodeValue);
        if (piece.status !== PieceStatus.CREATED) {
          throw new BadRequestException(
            `Barcode ${barcodeValue} is not awaiting receipt (current status: ${piece.status}) — only unreceived barcodes can be voided`,
          );
        }

        await this.prisma.$transaction(async (tx) => {
          const updated = await tx.piece.updateMany({
            where: { id: piece.id, status: PieceStatus.CREATED },
            data: { status: PieceStatus.VOID },
          });
          if (updated.count === 0) {
            throw new BadRequestException(
              `Barcode ${barcodeValue} was already processed by another request`,
            );
          }

          await tx.pieceStatusEvent.create({
            data: {
              pieceId: piece.id,
              fromStatus: PieceStatus.CREATED,
              toStatus: PieceStatus.VOID,
              actorUserId: adminId,
              actorRole,
              source: 'MANUAL',
              reasonCode: 'VOID',
              note: dto.reasonNote,
            },
          });
        });

        succeeded.push(await this.findByBarcodeOrThrow(barcodeValue));
      } catch (err) {
        failed.push({
          barcodeValue,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return { succeeded, failed };
  }

  // ── Inventory Manager: assign / clear shelf location via scan ─────────────
  async assignLocation(
    barcodeValue: string,
    dto: AssignPieceLocationDto,
    adminId: number,
  ) {
    const piece = await this.findByBarcodeOrThrow(barcodeValue);
    if (
      piece.status !== PieceStatus.IN_STOCK &&
      piece.status !== PieceStatus.RETURNED_IN_STOCK
    ) {
      throw new BadRequestException(
        `Barcode ${barcodeValue} is not in stock (current status: ${piece.status}) — only in-stock pieces can be shelved`,
      );
    }

    if (dto.locationId) {
      const location = await this.prisma.warehouseLocation.findUnique({
        where: { id: dto.locationId },
      });
      if (!location) {
        throw new NotFoundException(
          `Target location ${dto.locationId} does not exist`,
        );
      }
    }

    const updated = await this.prisma.piece.update({
      where: { id: piece.id },
      data: { locationId: dto.locationId },
      include: PIECE_INCLUDE,
    });

    await this.activityLogService.log({
      adminId,
      action: 'ASSIGN_PIECE_LOCATION',
      module: 'INVENTORY',
      targetId: piece.id,
      targetLabel: piece.barcodeValue,
      oldValue: { locationId: piece.locationId },
      newValue: { locationId: dto.locationId },
    });

    return updated;
  }

  // ── Barcode image (reuses BarcodeService's bwip-js rendering) ──────────────
  async generatePieceBarcodePng(barcodeValue: string): Promise<Buffer> {
    await this.findByBarcodeOrThrow(barcodeValue);
    return this.barcodeService.generateBarcodePng(barcodeValue);
  }

  // ── Inventory Manager: return lookup ────────────────────────────────────────
  async returnLookup(barcodeValue: string) {
    const piece = await this.findByBarcodeOrThrow(barcodeValue);
    if (piece.status !== PieceStatus.RETURNING) {
      throw new BadRequestException(
        `Barcode ${barcodeValue} is not awaiting return receipt (current status: ${piece.status})`,
      );
    }
    return piece;
  }

  // ── Inventory Manager: scan a physically-returned piece, mark Good/Damaged.
  // This is the ONLY path that restocks a piece-tracked return — nothing
  // else (including RefundService.receiveReturnItems, see refund.service.ts)
  // is allowed to increment ProductSize.quantity for a PIECE_BARCODE variant
  // without a scan having happened first. Damaged pieces never restock. ─────
  async returnReceive(barcodeValue: string, outcome: ReceiveOutcome, adminId: number, actorRole?: UserRole) {
    const piece = await this.findByBarcodeOrThrow(barcodeValue);
    if (piece.status !== PieceStatus.RETURNING) {
      throw new BadRequestException(
        `Barcode ${barcodeValue} is not awaiting return receipt (current status: ${piece.status})`,
      );
    }

    const toStatus =
      outcome === ReceiveOutcome.GOOD
        ? PieceStatus.RETURNED_IN_STOCK
        : PieceStatus.DAMAGED_RETURN;

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.piece.updateMany({
        where: { id: piece.id, status: PieceStatus.RETURNING },
        data: { status: toStatus },
      });
      if (updated.count === 0) {
        throw new BadRequestException(
          `Barcode ${barcodeValue} was already processed by another request`,
        );
      }

      await tx.pieceStatusEvent.create({
        data: {
          pieceId: piece.id,
          fromStatus: PieceStatus.RETURNING,
          toStatus,
          actorUserId: adminId,
          actorRole,
          source: 'SCAN',
        },
      });

      if (outcome === ReceiveOutcome.GOOD) {
        // Goes back to whatever locationId it already had — piece-status
        // transitions never clear location, so this is simply its last
        // assigned shelf, matching the spec's "returns to the same shelf."
        const adjustment = await this.stockLedgerService.recordAdjustment(tx, {
          productSizeId: piece.productSizeId,
          productId: piece.productSize.color.productId,
          delta: 1,
          reason: StockAdjustReason.ORDER_RETURNED,
          note: `Returned via piece barcode ${piece.barcodeValue}`,
          adminId,
          productLabel: piece.productSize.color.product.title,
        });
        return { adjustment };
      }

      return { adjustment: null };
    });

    if (result.adjustment) {
      this.stockEventsGateway.emitStockUpdated({
        productSizeId: piece.productSizeId,
        productId: piece.productSize.color.productId,
        quantity: result.adjustment.quantityAfter,
        lowStockAt: result.adjustment.lowStockAt,
      });
    }

    return this.findByBarcodeOrThrow(barcodeValue);
  }

  // ── Admin dashboard: piece counts by status ─────────────────────────────────
  async getInventorySummary() {
    const counts = await this.prisma.piece.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    const summary: Record<string, number> = {};
    for (const status of Object.values(PieceStatus)) summary[status] = 0;
    for (const c of counts) summary[c.status] = c._count._all;
    return summary;
  }

  // ── Admin dashboard: which barcodes are on which shelf right now ───────────
  async getShelfMap() {
    const locations = await this.prisma.warehouseLocation.findMany({
      include: {
        pieces: {
          // Both statuses mean "physically sitting on this shelf right now,
          // sellable" — RETURNED_IN_STOCK pieces never lost their location
          // (return receive doesn't clear it), so excluding them here would
          // make a returned-and-restocked piece invisible on its own shelf.
          where: { status: { in: [PieceStatus.IN_STOCK, PieceStatus.RETURNED_IN_STOCK] } },
          include: {
            productSize: {
              include: {
                size: true,
                color: {
                  include: { color: true, product: { select: { title: true } } },
                },
              },
            },
          },
        },
      },
      orderBy: { code: 'asc' },
    });

    return locations.map((l) => ({
      id: l.id,
      code: l.code,
      label: l.label,
      pieceCount: l.pieces.length,
      pieces: l.pieces.map((p) => ({
        barcodeValue: p.barcodeValue,
        productTitle: p.productSize.color.product.title,
        color: p.productSize.color.color.name,
        size: p.productSize.size.name,
      })),
    }));
  }

  // ── Admin dashboard: damaged pieces, split incoming vs. return ─────────────
  async getDamageReport(groupBy: 'supplier' | 'type') {
    const damaged = await this.prisma.piece.findMany({
      where: {
        status: { in: [PieceStatus.DAMAGED_INCOMING, PieceStatus.DAMAGED_RETURN] },
      },
      include: {
        supplier: { select: { id: true, name: true } },
        productSize: {
          include: { color: { include: { product: { select: { title: true } } } } },
        },
      },
    });

    if (groupBy === 'supplier') {
      const bySupplier = new Map<
        string,
        { supplierId: number | null; supplierName: string; incomingCount: number; returnCount: number }
      >();
      for (const p of damaged) {
        const key = p.supplierId ? String(p.supplierId) : 'unknown';
        if (!bySupplier.has(key)) {
          bySupplier.set(key, {
            supplierId: p.supplierId,
            supplierName: p.supplier?.name ?? 'Unknown / not recorded',
            incomingCount: 0,
            returnCount: 0,
          });
        }
        const entry = bySupplier.get(key)!;
        if (p.status === PieceStatus.DAMAGED_INCOMING) entry.incomingCount++;
        else entry.returnCount++;
      }
      return Array.from(bySupplier.values()).sort(
        (a, b) => b.incomingCount + b.returnCount - (a.incomingCount + a.returnCount),
      );
    }

    return {
      damagedIncoming: damaged.filter((p) => p.status === PieceStatus.DAMAGED_INCOMING)
        .length,
      damagedReturn: damaged.filter((p) => p.status === PieceStatus.DAMAGED_RETURN)
        .length,
    };
  }
}
