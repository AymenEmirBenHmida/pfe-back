import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from './entities/review.entity';
import { ClientKafka } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
export class ReviewService implements OnModuleInit {
  constructor(
    @InjectRepository(Review) private repo: Repository<Review>,
    @Inject('KAFKA_REVIEW_CLIENT') private readonly kafkaClient: ClientKafka,
  ) {}

  async onModuleInit() {
    const topics = ['user.getUsersByIds', 'order.confirmProductOrder'];
    // Subscribe to the reply topics
    topics.forEach((topic) => this.kafkaClient.subscribeToResponseOf(topic));

    try {
      await this.kafkaClient.connect();
      console.log('Review service connected to Kafka');
    } catch (error) {
      console.error(`Failed to connect to Kafka: ${error.message}`);
    }
  }
  async createReview(dto: CreateReviewDto) {
    const reviewsByUser = await this.getReviewsByUserAndByProduct(
      dto.userId,
      dto.productId,
    );
    // Check order validity through Kafka
    const validationResponse = await firstValueFrom(
      this.kafkaClient.send('order.confirmProductOrder', {
        productId: dto.productId,
        userId: dto.userId,
      }),
    );
    // Direct comparison without Boolean conversion
    let valid = false;

    // Handle different response formats
    if (validationResponse === true || validationResponse === 'true') {
      valid = true;
    }
    console.log(reviewsByUser, ' review BY uSER, and validity ' + valid);
    // Check if the user has already submitted a review
    if (reviewsByUser.length > 0 || !valid) {
      // User already has reviews, so don't create another one
      return null; // or throw an error, or return an appropriate message
    } else if (reviewsByUser.length === 0 && valid) {
      // User has no reviews yet, so create one
      const review = this.repo.create(dto);
      return this.repo.save(review);
    }
  }

  async getReviewsByProduct(productId: number) {
    const reviews = await this.repo.find({ where: { productId } });
    const productReviewsUsersIds = reviews.map((review) => {
      return review.userId;
    });
    const users = await firstValueFrom(
      this.kafkaClient.send('user.getUsersByIds', {
        ids: productReviewsUsersIds,
      }),
    );
    // 4. Map users by their id for faster lookup
    const userMap = new Map<number, { id: number; name: string }>();
    users.forEach((user) => {
      userMap.set(user.id, user); // Assume each user has id + name
    });

    // 5. Attach user names to reviews
    const reviewsWithUserNames = reviews.map((review) => ({
      ...review,
      userName: userMap.get(review.userId)?.name || 'Unknown User',
    }));
    return reviewsWithUserNames;
  }

  getReviewsByUser(userId: number) {
    return this.repo.find({ where: { userId } });
  }
  getReviewsByUserAndByProduct(userId: number, productId: number) {
    return this.repo.find({ where: { userId, productId } });
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
