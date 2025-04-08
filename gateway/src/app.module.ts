import { ConfigModule } from '@nestjs/config';
import { MiddlewareConsumer, Module } from '@nestjs/common';
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
  providers: [ServiceRegistryService],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware, ProxyMiddleware).forRoutes('*');
  }
}
