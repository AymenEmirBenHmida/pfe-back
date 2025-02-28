import { ConfigModule } from '@nestjs/config';
import { MiddlewareConsumer, Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProxyMiddleware } from './middlewares/proxy.middleware';
import { ServiceRegistryService } from './services/service-registry.service';

@Module({
  imports: [ConfigModule.forRoot({
    isGlobal:true,
    envFilePath: '.env',
    cache: true,
  })],
  controllers: [AppController],
  providers: [AppService, ServiceRegistryService],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ProxyMiddleware).forRoutes('*');
  }
}
