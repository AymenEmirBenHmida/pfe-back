import { Injectable } from '@nestjs/common';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from './entities/review.entity';
@Injectable()
export class ReviewService {
  constructor(@InjectRepository(Review) private repo: Repository<Review>) {}

  createReview(dto: CreateReviewDto) {
    const review = this.repo.create(dto);
    return this.repo.save(review);
  }

  getReviewsByProduct(productId: number) {
    return this.repo.find({ where: { productId } });
  }

  getReviewsByUser(userId: number) {
    return this.repo.find({ where: { userId } });
  }

  async getAverageRating(productId: number) {
    const { avg } = await this.repo
      .createQueryBuilder('review')
      .select('AVG(review.rating)', 'avg')
      .where('review.productId = :productId', { productId })
      .getRawOne();
    return Number(avg).toFixed(2);
  }

  async deleteByProductId(productId: number) {
    return this.repo.delete({ productId });
  }

  async deleteByUserId(userId: number) {
    return this.repo.delete({ userId });
  }
  async updateReview(id: number, dto: UpdateReviewDto) {
    await this.repo.update(id, dto);
    return this.repo.findOneBy({ id });
  }
  async deleteReview(id: number) {
    return this.repo.delete(id);
  }
}
