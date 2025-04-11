import { IsNumber, IsString, IsOptional, IsBoolean } from 'class-validator';

class FileResponseDto {
  @IsNumber()
  id: number;

  @IsString()
  filename: string;

  @IsString()
  path: string;

  @IsString()
  mimetype: string;
}

export class CategoryResponseDto {
  @IsNumber()
  id: number;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  image?: FileResponseDto; // now a full object

  @IsBoolean()
  isActive: boolean;

  @IsString()
  slug: string;

  @IsOptional()
  @IsNumber()
  parentId?: number;

  @IsOptional()
  children?: CategoryResponseDto[];

  @IsOptional()
  productsCount?: number;
}
