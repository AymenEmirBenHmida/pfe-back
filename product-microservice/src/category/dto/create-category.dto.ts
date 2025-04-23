import { IsString, IsOptional, IsBoolean, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCategoryDto {
  @ApiProperty({
    example: 'Electronics',
    description: 'The name of the category',
  })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    example: 'All kinds of electronic gadgets and devices.',
    description: 'Description of the category',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: 12,
    description: 'The ID of the image stored in the File table',
  })
  @IsOptional()
  @IsNumber()
  imageId?: number;

  @ApiPropertyOptional({
    example: true,
    description: 'Indicates whether the category is active or not',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    example: 'electronics',
    description: 'A URL-friendly slug for the category',
  })
  @IsString()
  slug: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'The ID of the parent category, if this is a subcategory',
  })
  @IsOptional()
  @IsNumber()
  parentId?: number;
}
