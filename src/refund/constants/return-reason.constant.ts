// Fixed set of categories a customer can file a return under — keeps
// ReturnRequest.reason a validated, structured value instead of accepting
// any free-text string. Requests filed before this allow-list existed may
// still carry old free-text values in the DB; that's fine to read back, it
// just can't be written going forward.
export const RETURN_REASON_CODES = [
  'DEFECTIVE_DAMAGED',
  'NOT_AS_DESCRIBED',
  'WRONG_ITEM_RECEIVED',
  'CHANGED_MIND',
  'WRONG_SIZE',
  'OTHER',
] as const;

export type ReturnReasonCode = (typeof RETURN_REASON_CODES)[number];
