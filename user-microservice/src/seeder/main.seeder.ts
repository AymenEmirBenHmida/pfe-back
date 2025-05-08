import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { UserSeeder } from './user.seeder';

async function bootstrap() {
  const appContext = await NestFactory.createApplicationContext(AppModule);
  const seeder = appContext.get(UserSeeder);

  await seeder.run();

  await appContext.close();
}

bootstrap();
