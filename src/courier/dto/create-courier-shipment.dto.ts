import {
  IsInt,
  IsOptional,
  IsString,
  IsNumber,
  IsObject,
  IsPositive,
  Min,
  ValidateNested,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCourierShipmentDto {
  @IsInt({ message: 'orderId must be an integer' })
  @IsPositive({ message: 'orderId must be a positive number' })
  @IsNotEmpty({ message: 'orderId is required' })
  orderId: number;

  @IsInt({ message: 'providerId must be an integer' })
  @IsPositive({ message: 'providerId must be a positive number' })
  @IsNotEmpty({ message: 'providerId is required' })
  providerId: number;

  @IsOptional()
  @IsString()
  special_instruction?: string;

  @IsOptional()
  @IsString({ message: 'consignmentId must be a string' })
  @MinLength(1, { message: 'consignmentId cannot be empty' })
  @MaxLength(100, { message: 'consignmentId too long' })
  consignmentId?: string;

  @IsOptional()
  @IsNumber({}, { message: 'deliveryCharge must be a number' })
  @Min(0, { message: 'deliveryCharge cannot be negative' })
  deliveryCharge?: number;

  @IsOptional()
  @IsNumber({}, { message: 'codAmount must be a number' })
  @Min(0, { message: 'codAmount cannot be negative' })
  codAmount?: number;

  @IsOptional()
  @IsString({ message: 'recipientName must be a string' })
  @MinLength(1, { message: 'recipientName cannot be empty' })
  @MaxLength(150, { message: 'recipientName too long' })
  recipientName?: string;

  @IsOptional()
  @IsString({ message: 'recipientPhone must be a string' })
  @MinLength(1, { message: 'recipientPhone cannot be empty' })
  @MaxLength(20, { message: 'recipientPhone too long' })
  recipientPhone?: string;

  @IsOptional()
  @IsString({ message: 'recipientAddress must be a string' })
  @MinLength(1, { message: 'recipientAddress cannot be empty' })
  @MaxLength(500, { message: 'recipientAddress too long' })
  recipientAddress?: string;

  @IsOptional()
  @IsNumber({}, { message: 'weight must be a number' })
  @IsPositive({ message: 'weight must be greater than 0' })
  weight?: number;

  @IsOptional()
  @IsString({ message: 'itemDescription must be a string' })
  @MaxLength(500, { message: 'itemDescription too long' })
  itemDescription?: string;

  @IsOptional()
  @IsInt({ message: 'deliveryType must be an integer' })
  @IsIn([12, 48], { message: 'deliveryType must be 12 (on demand) or 48 (normal)' })
  deliveryType?: number;

  @IsOptional()
  @IsInt({ message: 'itemType must be an integer' })
  @IsIn([1, 2], { message: 'itemType must be 1 (document) or 2 (parcel)' })
  itemType?: number;

  @IsOptional()
  @IsObject({ message: 'metadata must be an object' })
  @ValidateNested()
  @Type(() => Object)
  metadata?: {
    /**
     * Provider-specific data
     */
    pathao?: PathaoMetadata;
    redx?: RedxMetadata;
    steadfast?: SteadfastMetadata;
    paperfly?: PaperflyMetadata;

    /**
     * Additional custom fields
     */
    [key: string]: any;
  };
}

// Provider-specific metadata interfaces
export interface PathaoMetadata {
  store_id?: number;
  delivery_type?: number;
  item_type?: number;
  special_instruction?: string;
  item_weight?: string;
  item_description?: string;
}

export interface RedxMetadata {
  area_id?: number;
  special_instruction?: string;
  value?: number;
}

export interface SteadfastMetadata {
  note?: string;
  invoice?: string;
}

export interface PaperflyMetadata {
  shop_id?: string;
  note?: string;
  product_type?: string;
}
