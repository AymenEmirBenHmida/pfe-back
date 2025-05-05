import { Module } from '@nestjs/common';
import { CategoryService } from './category.service';
import { CategoryController } from './category.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from './entities/category.entity';
import { FileModule } from 'src/file/file.module';

@Module({
  controllers: [CategoryController],
  imports: [TypeOrmModule.forFeature([Category]), FileModule],
  exports: [CategoryService],
  providers: [CategoryService],
})
export class CategoryModule {}
