import { IsString, IsOptional, IsBoolean, IsNumber } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  imageId?: number; // ID of the image in the File table

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsString()
  slug: string;

  @IsOptional()
  @IsNumber()
  parentId?: number;
}
