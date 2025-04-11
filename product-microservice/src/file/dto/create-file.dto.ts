import {
  IsEnum,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsString,
} from 'class-validator';
import { FileType } from '../entities/file.entity';

export class CreateFileDto {
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
  @IsOptional()
  type?: FileType;

  @IsOptional()
  @IsString()
  alt?: string;

  @IsOptional()
  @IsBoolean()
  isMain?: boolean;

  @IsOptional()
  @IsNumber()
  displayOrder?: number;

  @IsOptional()
  @IsNumber()
  entityId?: number;

  @IsOptional()
  @IsString()
  entityType?: string;

  @IsOptional()
  @IsNumber()
  productId?: number;
}
