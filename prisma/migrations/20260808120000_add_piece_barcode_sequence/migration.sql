-- Piece generation is about to run on every product creation (not just the
-- occasional manual "Generate & Print" action), so the barcode numbering
-- source needs to be race-safe under concurrent transactions instead of
-- deriving the next value from `COUNT(*)`.
CREATE SEQUENCE IF NOT EXISTS "piece_barcode_seq" START 1;
