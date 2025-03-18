import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';
import { ConfigService } from '@nestjs/config';
import * as events from 'events';

async function bootstrap() {
  // Increase Node.js EventEmitter max listeners to avoid warnings
  events.setMaxListeners(30);
  const app = await NestFactory.create(AppModule);
  // Add cookie parser middleware
  app.use(cookieParser());

  // Enable CORS for frontend requests
  app.enableCors({
    origin: true, // Allow all origins or specify your frontend URL
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });
  // Get config service
  const configService = app.get(ConfigService);

  // Start the gateway service
  const port = configService.get('PORT') || 3000;
  await app.listen(port);
  console.log(`API Gateway running on port ${port}`);
}
bootstrap();
