import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as cookieParser from 'cookie-parser';
import { Transport } from '@nestjs/microservices';
import { HttpExceptionFilter } from './filters/http-exception.filter';
async function bootstrap() {
  //create the NestJS application
  const app = await NestFactory.create(AppModule);
  //enabel cors for the frontend to be able to access the backend
  app.enableCors({
    origin: ['http://localhost:3000', 'http://localhost:3002'], // Add your frontend URLs
    credentials: true, // CRITICAL for cookies to work!
  });
  //use cookie-parser middleware to be able to handle the cookies in the requests
  app.use(cookieParser());
  // Use Http exception filter
  app.useGlobalFilters(new HttpExceptionFilter());
  //connect tot he microservices using TCP protocol
  // app.connectMicroservice({ transport: Transport.TCP });
  const configService = app.get(ConfigService);

  // Connect to Kafka - replace TCP with Kafka
  app.connectMicroservice({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: 'authentication',
        brokers: configService
          .get('KAFKA_BROKERS', 'localhost:29092')
          .split(','),
      },
      consumer: {
        groupId: 'auth-consumer',
      },
    },
  });

  //use the validation pipe globally to validate the incoming requests
  await app.useGlobalPipes(new ValidationPipe());
  //get the config service instance to get the PORT value
  //start the microservices and listen to the PORT
  await app.startAllMicroservices();
  await app.listen(+configService.get('PORT'));
}
bootstrap();
