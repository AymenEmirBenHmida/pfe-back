import { IsString, IsNumber, IsOptional, IsObject } from 'class-validator';

export class CreateProductDto {
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
}
