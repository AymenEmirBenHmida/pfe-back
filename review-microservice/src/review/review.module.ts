import { Module } from '@nestjs/common';
import { ReviewService } from './review.service';
import { ReviewController } from './review.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Review } from './entities/review.entity';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forFeature([Review]),
    ClientsModule.registerAsync([
      {
        name: 'KAFKA_REVIEW_CLIENT',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            // Kafka client configuration
            client: {
              clientId: 'review-service',
              brokers: configService
                .get('KAFKA_BROKERS', 'localhost:29092')
                .split(','),
              retry: {
                initialRetryTime: 300,
                retries: 10,
              },
            },
            // Consumer group configuration
            consumer: {
              groupId: 'review-consumer', // UNIQUE!
              allowAutoTopicCreation: true,
            },
          },
        }),
      },
    ]),
  ],
  controllers: [ReviewController],
  providers: [ReviewService],
})
export class ReviewModule {}
