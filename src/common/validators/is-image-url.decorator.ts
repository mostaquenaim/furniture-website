import { applyDecorators } from '@nestjs/common';
import {
  IsNotEmpty,
  IsString,
  IsUrl,
  MaxLength,
  ValidateIf,
} from 'class-validator';

interface IsImageUrlOptions {
  /** Allow undefined / null / "" (the admin forms send "" for "no image"). */
  optional?: boolean;
  /** Validate every entry of a string array. */
  each?: boolean;
}

/**
 * Single rule for every stored image reference: an absolute http(s) URL of
 * sane length. Rejects relative paths, data: URIs (base64 blobs in the DB)
 * and arbitrary strings that would render as broken images on the storefront.
 */
export function IsImageUrl({
  optional = false,
  each = false,
}: IsImageUrlOptions = {}) {
  return applyDecorators(
    optional
      ? ValidateIf((_, value) => value !== undefined && value !== null && value !== '')
      : IsNotEmpty({ each }),
    IsString({ each }),
    IsUrl(
      { protocols: ['http', 'https'], require_protocol: true },
      {
        each,
        message: each
          ? 'each value in $property must be a valid http(s) image URL'
          : '$property must be a valid http(s) image URL',
      },
    ),
    MaxLength(2048, { each }),
  );
}
