import { IsOptional, IsEnum, IsNumberString } from 'class-validator';
import { OrderStatus } from '../entities/order.entity';

export class OrderFilterDto {
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
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsNumberString()
  minAmount?: number;

  @IsOptional()
  @IsNumberString()
  maxAmount?: number;

  @IsOptional()
  sortBy?: string;

  @IsOptional()
  sortOrder?: 'ASC' | 'DESC';
}
