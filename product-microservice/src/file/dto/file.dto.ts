import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsBoolean,
} from 'class-validator';
import { FileType } from '../entities/file.entity';
import { Product } from '../../product/entities/product.entity';

export class FileResponseDto {
  @IsNumber()
  id: number;

  @IsString()
  filename: string;

  @IsString()
  path: string;

  @IsString()
  mimetype: string;

  @IsOptional()
  @IsNumber()
  size?: number;

  @IsEnum(FileType)
  type: FileType;

  @IsOptional()
  @IsString()
  alt?: string;

  @IsBoolean()
  isMain: boolean;

  @IsNumber()
  displayOrder: number;

  @IsOptional()
  @IsNumber()
  entityId?: number;

  @IsOptional()
  @IsString()
  entityType?: string;

  @IsOptional()
  @IsNumber()
  productId?: number;

  @IsOptional()
  product?: Product; // Optionally include the related product information

  @IsString()
  uploadedAt: Date; // ISO string format date
}
