import { Module, OnModuleInit } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserModule } from '../user/user.module';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';

/**
 * Authentication Module
 * Handles user authentication and authorization functionality
 * Integrates with Kafka message broker for event-driven communication
 */
@Module({
  imports: [
    UserModule,
    /**
     * Kafka client configuration
     * Sets up the connection to Kafka broker(s) for messaging
     */
    ClientsModule.registerAsync([
      {
        name: 'KAFKA_SERVICE',
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
              groupId: 'user-consumer',
              allowAutoTopicCreation: true,
            },
          },
        }),
      },
    ]),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
/**
 * AuthModule class implementing OnModuleInit
 * Handles initialization logic when the module is loaded
 */
export class AuthModule implements OnModuleInit {
  constructor(private moduleRef: ModuleRef) {}

  /**
   * Lifecycle hook that runs when the module is initialized
   * Ensures AuthService is properly initialized
   */
  async onModuleInit() {
    const authService = this.moduleRef.get(AuthService);
    await authService.onModuleInit();
  }
}
