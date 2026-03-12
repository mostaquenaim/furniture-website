import {
  IsInt,
  IsOptional,
  IsString,
  IsNumber,
  IsObject,
  IsPositive,
  Min,
  Max,
  ValidateNested,
  IsNotEmpty,
  MinLength,
  MaxLength,
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

// Alternative: More flexible approach using generics
export class CreateCourierShipmentDtoWithGeneric<T = any> {
  @IsInt()
  @IsPositive()
  orderId: number;

  @IsInt()
  @IsPositive()
  providerId: number;

  @IsOptional()
  @IsString()
  consignmentId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  deliveryCharge?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  codAmount?: number;

  @IsOptional()
  @IsObject()
  metadata?: T;
}

// DTO for creating shipment with specific provider data
// export class CreatePathaoShipmentDto extends CreateCourierShipmentDtoWithGeneric<PathaoMetadata> {
//   // Pathao-specific validation
//   @IsOptional()
//   @ValidateNested()
//   @Type(() => Object)
//   metadata?: PathaoMetadata;
// }
