import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { ImageModule } from '../image/image.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
@Module({
  controllers: [UserController],
  providers: [UserService],
  imports: [
    TypeOrmModule.forFeature([User]),
    ImageModule,
    ClientsModule.registerAsync([
      {
        name: 'KAFKA_USER_CLIENT',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            // Kafka client configuration
            client: {
              clientId: 'user-service',
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
              groupId: 'user-consumer', // UNIQUE!
              allowAutoTopicCreation: true,
            },
          },
        }),
      },
    ]),
  ],
  exports: [UserService],
})
export class UserModule {}
