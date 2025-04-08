import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpExceptionFilter } from './filters/http-exception.filter';
async function bootstrap() {
  const logger = new Logger('Notification Service');
  //create the microservice
  const configService = new ConfigService();
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.KAFKA,
      options: {
        client: {
          brokers: [configService.get('KAFKA_BROKER') || 'localhost:29092'],
          clientId: 'notification-service',
        },
        consumer: {
          groupId: 'notification-consumer',
          allowAutoTopicCreation: true,
        },
      },
    },
  );
  // Use Http exception filter
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.listen();
}
bootstrap();
