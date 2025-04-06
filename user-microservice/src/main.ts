import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { existsSync } from 'fs';

/**
 * Bootstrap function to initialize and start the NestJS application
 * This sets up both HTTP and Kafka microservice capabilities
 */
async function bootstrap() {
  const logger = new Logger('Bootstrap');
  // Initialize NestJS application with full logging enabled
  // This helps with debugging and monitoring application behavior
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // Enable CORS for frontend access
  app.enableCors({
    origin: ['http://localhost:3000', 'http://localhost:3002'], // Allowed frontend URLs
    credentials: true, // CRITICAL for cookies to work!
  });

  // Get ConfigService instance
  const configService = app.get(ConfigService);
  const kafkaBrokers = configService.get<string>(
    'KAFKA_BROKERS',
    'localhost:29092',
  );
  console.log(`Kafka Brokers: ${kafkaBrokers}`);
app.use('/uploads', (req, res, next) => {
  req.url = req.url.replace(/\/+$/, ''); // Remove trailing slashes
  console.log('Cleaned request path:', req.url);
  next();
});
  // Serve static files from the uploads directory with /uploads prefix
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads',
  });
  console.log('Serving static files from:', join(process.cwd(), 'uploads'));
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
  // Use Http exception filter
  app.useGlobalFilters(new HttpExceptionFilter());
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
