import { IsOptional, IsNumberString, IsString } from 'class-validator';

export class ReviewFilterDto {
  @IsOptional()
  @IsNumberString()
  page?: number;

  @IsOptional()
  @IsNumberString()
  limit?: number;

  @IsOptional()
  @IsNumberString()
  userId?: number;

  @IsOptional()
  @IsNumberString()
  productId?: number;

  @IsOptional()
  @IsString()
  search?: string;
  @IsOptional()
  @IsNumberString()
  minRating?: number;

  @IsOptional()
  @IsNumberString()
  maxRating?: number;

  @IsOptional()
  sortBy?: string; // e.g., 'createdAt', 'rating'

  @IsOptional()
  sortOrder?: 'ASC' | 'DESC';
}
