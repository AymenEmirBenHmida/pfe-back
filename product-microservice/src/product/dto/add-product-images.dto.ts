// update-product-images.dto.ts
import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional } from 'class-validator';

export class ImageOrderItemDto {
  @IsNumber()
  order: number;

  @IsBoolean()
  isOld: boolean;

  @IsOptional()
  @IsNumber()
  id?: number;

}

export class AddProductImagesDto {
  @Type(() => ImageOrderItemDto)
  images: ImageOrderItemDto[];
}
