import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from './entities/review.entity';
import { ClientKafka } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { ReviewFilterDto } from './dto/review-filter.dto';

@Injectable()
export class ReviewService implements OnModuleInit {
  constructor(
    @InjectRepository(Review) private repo: Repository<Review>,
    @Inject('KAFKA_REVIEW_CLIENT') private readonly kafkaClient: ClientKafka,
  ) {}

  async onModuleInit() {
    // List of ALL topics that this service needs to subscribe to
    const topics = [
      'user.getUsersByIds',
      'order.confirmProductOrder',
      'product.getProductsByIds', // Added this topic
    ];

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
      return {hasAlready: true}; // or throw an error, or return an appropriate message
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
    const updatedReview = await this.repo.update(id, dto);
    console.log(dto);
    console.log(id, ' id,', dto + ' dto');
    console.log(updatedReview, 'updated review');
    return this.repo.findOneBy({ id });
  }

  async deleteReview(id: number) {
    return this.repo.delete(id);
  }

  async findOne(id: number) {
    const review = await this.repo.findOne({ where: { id } });

    if (!review) {
      return null;
    }
    // Get product information through Kafka
    const products = await firstValueFrom(
      this.kafkaClient.send('product.getProductsByIds', {
        ids: [review?.productId],
      }),
    );

    // Get user information through Kafka
    const users = await firstValueFrom(
      this.kafkaClient.send('user.getUsersByIds', {
        ids: [review.userId],
      }),
    );

    // Add user information to the review
    const userInfo = users && users.length > 0 ? users[0] : null;
    const productInfo = products && products.length > 0 ? products[0] : null;

    const reviewWithUser = {
      ...review,
      user: userInfo || { id: review.userId, name: 'Unknown User' },
      product: productInfo || { id: review.productId, name: 'Unknown Product' },
    };

    return reviewWithUser;
  }

  async findAll() {
    const reviews = await this.repo.find();
    // Extract all product IDs from reviews
    const productIds = reviews.map((review) => review.productId);

    // Extract all user IDs from reviews
    const userIds = reviews.map((review) => review.userId);

    // Get user information through Kafka
    const users = await firstValueFrom(
      this.kafkaClient.send('user.getUsersByIds', {
        ids: userIds,
      }),
    );
    // Get product information through Kafka
    const products = await firstValueFrom(
      this.kafkaClient.send('product.getProductsByIds', {
        ids: productIds,
      }),
    );
    // Create a map of users by ID for faster lookup
    const userMap = new Map<number, { id: number; name: string }>();
    users.forEach((user) => {
      userMap.set(user.id, user);
    });
    // Map products by their id for faster lookup
    const productMap = new Map<number, any>();
    products.forEach((product) => {
      productMap.set(product.id, product);
    });

    // Add user information to reviews
    const reviewsWithUserInfo = reviews.map((review) => ({
      ...review,
      user: userMap.get(review.userId),
      product: productMap.get(review.productId) || {
        id: review.productId,
        name: 'Unknown Product',
      },
    }));

    return reviewsWithUserInfo;
  }
  async findAllFilteredReviews({
    page,
    limit,
    userId,
    productId,
    minRating,
    maxRating,
    search,
    sortBy = 'createdAt',
    sortOrder = 'DESC',
  }: ReviewFilterDto) {
    const query = this.repo.createQueryBuilder('review');

    const currentPage = Math.max(Number(page) || 1, 1);
    const currentLimit = Math.max(Number(limit) || 10, 1);
    if (search) {
      query.andWhere('review.comment ILIKE :search', { search: `%${search}%` });
    }

    if (userId !== undefined) {
      query.andWhere('review.userId = :userId', { userId });
    }

    if (productId !== undefined) {
      query.andWhere('review.productId = :productId', { productId });
    }

    if (minRating !== undefined) {
      query.andWhere('review.rating >= :minRating', { minRating });
    }

    if (maxRating !== undefined) {
      query.andWhere('review.rating <= :maxRating', { maxRating });
    }

    query.orderBy(
      `review.${sortBy}`,
      sortOrder.toUpperCase() as 'ASC' | 'DESC',
    );
    query.skip((currentPage - 1) * currentLimit).take(currentLimit);

    const [reviews, total] = await query.getManyAndCount();

    const userIds = reviews.map((r) => r.userId);
    const productIds = reviews.map((r) => r.productId);

    const [users, products] = await Promise.all([
      firstValueFrom(
        this.kafkaClient.send('user.getUsersByIds', {
          ids: userIds,
        }),
      ),
      firstValueFrom(
        this.kafkaClient.send('product.getProductsByIds', {
          ids: productIds,
        }),
      ),
    ]);

    const userMap = new Map<number, { id: number; name: string }>();
    users.forEach((user) => userMap.set(user.id, user));

    const productMap = new Map<number, any>();
    products.forEach((product) => productMap.set(product.id, product));

    const data = reviews.map((review) => ({
      ...review,
      user: userMap.get(review.userId),
      product: productMap.get(review.productId) || {
        id: review.productId,
        name: 'Unknown Product',
      },
    }));

    return {
      data,
      total,
      page: currentPage,
      limit: currentLimit,
      totalPages: Math.ceil(total / currentLimit),
    };
  }
}
