import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { HttpExceptionFilter } from './filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Get ConfigService instance
  const configService = app.get(ConfigService);
  const kafkaBrokers = configService.get<string>(
    'KAFKA_BROKERS',
    'localhost:29092',
  );
  // Configure Kafka microservice connection
  // This sets up the application as a Kafka consumer/producer
  app.connectMicroservice({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: 'review-service', // Unique identifier for this service
        brokers: kafkaBrokers.split(','), // Support multiple broker addresses
        retry: {
          initialRetryTime: 300, // Initial retry delay in ms
          retries: 10, // Number of connection retry attempts
        },
      },
      consumer: {
        groupId: 'review-consumer', // Consumer group for this service
        allowAutoTopicCreation: true, // Automatically create topics if they don't exist
      },
    },
  });

  // Get port number
  const port = configService.get('PORT', 3006);
  // Use Http exception filter
  app.useGlobalFilters(new HttpExceptionFilter());
  // logger.log('Starting microservices...');
  await app.startAllMicroservices();
  // logger.log('Microservices started successfully');
  // Swagger set up
  const options = new DocumentBuilder()
    .setTitle('Review API')
    .setDescription(
      'this is the product microservice responsible for managing reviews.',
    )
    .setVersion('1.0')
    .addServer('http://localhost:' + port, 'Local environment')
    .addTag('Your API Tag')
    .build();

  const document = SwaggerModule.createDocument(app, options);
  SwaggerModule.setup('api-docs', app, document);
  // Initialize HTTP server on configured port
  // This allows the service to handle both HTTP requests and Kafka events
  await app.listen(port);
  // logger.log(`User microservice running on port ${port}`);
}
// Handle any errors during bootstrap process
bootstrap().catch((err) => {
  console.error('Failed to start application:', err);
});
