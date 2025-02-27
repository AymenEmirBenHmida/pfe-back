import { ConfigModule } from '@nestjs/config';
import { MiddlewareConsumer, Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProxyMiddleware } from './middlewares/proxy.middleware';
import { ServiceRegistryService } from './services/service-registry.service';
import { AuthMiddleware } from './middlewares/auth.middleware';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      cache: true,
    }),
    HttpModule, // Add this line to import HttpModule
  ],
  controllers: [AppController],
  providers: [AppService, ServiceRegistryService],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware, ProxyMiddleware).forRoutes('*');
  }
}
