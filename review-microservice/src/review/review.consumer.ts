import { KafkaContext, Payload } from '@nestjs/microservices';
import { Controller } from '@nestjs/common';
import { EventPattern } from '@nestjs/microservices';
import { ReviewService } from './review.service';

@Controller()
export class ReviewConsumer {
  constructor(private readonly reviewService: ReviewService) {}

  @EventPattern('product.deleted')
  async handleProductDeleted(@Payload() productId: number) {
    await this.reviewService.deleteByProductId(productId);
  }

  @EventPattern('user.deleted')
  async handleUserDeleted(@Payload() userId: number) {
    await this.reviewService.deleteByUserId(userId);
  }
}
