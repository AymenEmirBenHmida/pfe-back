import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as cookieParser from 'cookie-parser';
import { Transport } from '@nestjs/microservices';
async function bootstrap() {
  //create the NestJS application
  const app = await NestFactory.create(AppModule);
  //use cookie-parser middleware to be able to handle the cookies in the requests
  app.use(cookieParser());
  //connect tot he microservices using TCP protocol
  // app.connectMicroservice({ transport: Transport.TCP });
  const configService = app.get(ConfigService);

  // Connect to Kafka - replace TCP with Kafka
  app.connectMicroservice({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: 'authentication',
        brokers: configService.get('KAFKA_BROKERS', 'kafka:9092').split(','),
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
