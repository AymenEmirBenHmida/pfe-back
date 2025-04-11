import { IsNumber, IsString, IsOptional, IsObject } from 'class-validator';
import { CategoryResponseDto } from 'src/category/dto/category.dto';
import { FileResponseDto } from 'src/file/dto/file.dto';

export class ProductResponseDto {
  @IsNumber()
  id: number;

  @IsString()
  name: string;

  @IsNumber()
  price: number;

  @IsNumber()
  stock: number;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsObject()
  characteristics?: Record<string, string>;

  @IsString()
  description: string;

  @IsNumber()
  categoryId: number;

  @IsOptional()
  category?: CategoryResponseDto; // The category information, if included

  @IsOptional()
  files?: FileResponseDto[]; // The files related to the product, including images, if needed

  @IsOptional()
  mainImage?: FileResponseDto; // The main image of the product, if available

  @IsOptional()
  galleryImages?: FileResponseDto[]; // The gallery images of the product
}
