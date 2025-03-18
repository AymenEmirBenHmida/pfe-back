import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

/**
 * Bootstrap function to initialize and start the NestJS application
 * This sets up both HTTP and Kafka microservice capabilities
 */
async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Initialize NestJS application with full logging enabled
  // This helps with debugging and monitoring application behavior
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });
  //enabel cors for the frontend to be able to access the backend
  app.enableCors({
    origin: ['http://localhost:3000', 'http://localhost:3002'], // Add your frontend URLs
    credentials: true, // CRITICAL for cookies to work!
  });
  // Get configuration service instance to access environment variables
  const configService = app.get(ConfigService);
  const kafkaBrokers = configService.get('KAFKA_BROKERS', 'localhost:29092');

  logger.log(`Configuring Kafka microservice with brokers: ${kafkaBrokers}`);

  // Configure Kafka microservice connection
  // This sets up the application as a Kafka consumer/producer
  app.connectMicroservice({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: 'user-service', // Unique identifier for this service
        brokers: kafkaBrokers.split(','), // Support multiple broker addresses
        retry: {
          initialRetryTime: 300, // Initial retry delay in ms
          retries: 10, // Number of connection retry attempts
        },
      },
      consumer: {
        groupId: 'user-consumer', // Consumer group for this service
        allowAutoTopicCreation: true, // Automatically create topics if they don't exist
      },
    },
  });

  logger.log('Starting microservices...');
  await app.startAllMicroservices();
  logger.log('Microservices started successfully');

  // Initialize HTTP server on configured port
  // This allows the service to handle both HTTP requests and Kafka events
  const port = configService.get('PORT', 3002);
  await app.listen(port);
  logger.log(`User microservice running on port ${port}`);
}

// Handle any errors during bootstrap process
bootstrap().catch((err) => {
  console.error('Failed to start application:', err);
});
