import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { AddCartItemDto } from 'src/cart/dto/addCartItem.dto';

export class GuestAddCartItemDto extends AddCartItemDto {
  // @IsString, not @IsUUID: cart routes still accept legacy visitorIds
  // until visitors are migrated (see PATCH guest/migrate)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  visitorId!: string;
}
