-- `piece_barcode_seq` was created starting at 1 (see migration
-- `add_piece_barcode_sequence`), but pieces already existed at that point
-- from the earlier COUNT(*)-based generation logic. That left the sequence
-- trailing behind real data, so nextval() immediately collided with
-- existing barcodeValue rows (P2002 unique constraint failures on
-- tx.piece.create). Resync the sequence to start after the highest
-- existing "PC-########" barcode number.
DO $$
DECLARE
  max_num BIGINT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING("barcodeValue" FROM 4) AS BIGINT)), 0)
    INTO max_num
    FROM "Piece"
    WHERE "barcodeValue" ~ '^PC-[0-9]+$';

  IF max_num > 0 THEN
    PERFORM setval('piece_barcode_seq', max_num, true);
  END IF;
END $$;
