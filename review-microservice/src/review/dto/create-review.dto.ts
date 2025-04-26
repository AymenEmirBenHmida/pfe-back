import {
  IsInt,
  IsString,
  Min,
  Max,
  IsNotEmpty,
  IsPositive,
} from 'class-validator';

export class CreateReviewDto {
  @IsInt()
  @IsPositive()
  productId: number;

  @IsInt()
  @IsPositive()
  userId: number;

  @IsInt()
  @Min(1)
  @Max(5)
  rating: number; // 1-5

  @IsString()
  @IsNotEmpty()
  comment: string;
}
