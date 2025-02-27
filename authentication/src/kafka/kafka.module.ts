import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { KafkaService } from './kafka.service';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'KAFKA_SERVICE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId: 'authentication',
              brokers: configService
                .get('KAFKA_BROKERS', 'kafka:9092')
                .split(','),
              // Add retry configuration
              retry: {
                initialRetryTime: 300,
                retries: 8, // Will retry for ~2 mins total
              },
            },
            consumer: {
              groupId: 'auth-consumer',
              allowAutoTopicCreation: true, // Explicitly enable auto-creation
            },
            producer: {
              allowAutoTopicCreation: true,
            },
          },
        }),
      },
    ]),
  ],
  providers: [KafkaService],
  exports: [KafkaService],
})
export class KafkaModule {}
