import { BadRequestException } from '@nestjs/common';

export type SortDirection = 'asc' | 'desc';

export interface ParsedSort<F extends string> {
  field: F;
  direction: SortDirection;
}

// List endpoints used to drop ?sortBy straight into Prisma's orderBy, so any
// unknown column (or the storefront's "featured") blew up as a 500. Each
// endpoint now passes a whitelist mapping public sort keys to real columns.
// Returns undefined when no sortBy is given — the caller's default applies.
export function parseSortParams<F extends string>(
  sortBy: unknown,
  order: unknown,
  allowed: Readonly<Record<string, F>>,
  defaultDirection: SortDirection,
): ParsedSort<F> | undefined {
  if (order !== undefined && order !== 'asc' && order !== 'desc') {
    throw new BadRequestException('order must be "asc" or "desc"');
  }

  if (sortBy === undefined || sortBy === '') return undefined;

  // own-property check so keys like "constructor" or "__proto__" can't
  // resolve through Object.prototype
  if (
    typeof sortBy !== 'string' ||
    !Object.prototype.hasOwnProperty.call(allowed, sortBy)
  ) {
    throw new BadRequestException(
      `sortBy must be one of: ${Object.keys(allowed).join(', ')}`,
    );
  }

  return {
    field: allowed[sortBy],
    direction: (order as SortDirection | undefined) ?? defaultDirection,
  };
}
