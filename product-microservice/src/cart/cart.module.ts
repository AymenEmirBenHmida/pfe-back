import { Module } from '@nestjs/common';
import { CartService } from './cart.service';
import { CartController } from './cart.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cart } from './entities/cart.entity';
import { CartItem } from './entities/cart-item.entity';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ProductModule } from 'src/product/product.module';
import { ProductService } from 'src/product/product.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Cart, CartItem]),
    ClientsModule.registerAsync([
      {
        name: 'KAFKA_CART_CLIENT',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            // Kafka client configuration
            client: {
              clientId: 'cart-service',
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
              groupId: 'cart-consumer', // UNIQUE!
              allowAutoTopicCreation: true,
            },
          },
        }),
      },
    ]),
    ProductModule,
  ],
  controllers: [CartController],
  providers: [CartService],
})
export class CartModule {}
