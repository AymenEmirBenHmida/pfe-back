export class CreateReviewDto {
  productId: number;
  userId: number;
  rating: number; // 1-5
  comment: string;
}
