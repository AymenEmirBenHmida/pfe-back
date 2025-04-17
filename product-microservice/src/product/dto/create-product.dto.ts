import { IsString, IsNumber, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiProperty({
    example: 'Wireless Mouse',
    description: 'The name of the product',
  })
  @IsString()
  name: string;

  @ApiProperty({
    example: 29.99,
    description: 'Price of the product',
  })
  @IsNumber()
  price: number;

  @ApiProperty({
    example: 150,
    description: 'Number of items available in stock',
  })
  @IsNumber()
  stock: number;

  @ApiPropertyOptional({
    example: 'Logitech',
    description: 'Brand name of the product',
  })
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional({
    example: {
      color: 'black',
      connectivity: 'wireless',
      battery: 'AA',
    },
    description: 'Additional characteristics of the product',
  })
  @IsOptional()
  @IsObject()
  characteristics?: Record<string, string>;

  @ApiProperty({
    example: 'Ergonomic wireless mouse with adjustable DPI and silent clicks.',
    description: 'Detailed description of the product',
  })
  @IsString()
  description: string;

  @ApiProperty({
    example: 3,
    description: 'The ID of the product category',
  })
  @IsNumber()
  categoryId: number;
}
