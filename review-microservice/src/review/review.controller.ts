import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { ReviewService } from './review.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';

@Controller('review')
export class ReviewController {
  constructor(private readonly service: ReviewService) {}

  @Post()
  create(@Body() dto: CreateReviewDto) {
    return this.service.createReview(dto);
  }

  @Get('/product/:productId')
  getByProduct(@Param('productId') productId: number) {
    return this.service.getReviewsByProduct(productId);
  }

  @Get('/user/:userId')
  getByUser(@Param('userId') userId: number) {
    return this.service.getReviewsByUser(userId);
  }

  @Get('/product/:productId/average')
  getAvg(@Param('productId') productId: number) {
    return this.service.getAverageRating(productId);
  }

  @Patch(':id')
  update(@Param('id') id: number, @Body() dto: UpdateReviewDto) {
    return this.service.updateReview(id, dto);
  }
  @Delete(':id')
  remove(@Param('id') id: number) {
    return this.service.deleteReview(id);
  }

  // @Get()
  // findAll() {
  //   return this.service.findAll();
  // }

  // @Get(':id')
  // findOne(@Param('id') id: string) {
  //   return this.service.findOne(+id);
  // }

  // @Patch(':id')
  // update(@Param('id') id: string, @Body() updateReviewDto: UpdateReviewDto) {
  //   return this.service.update(+id, updateReviewDto);
  // }

  // @Delete(':id')
  // remove(@Param('id') id: string) {
  //   return this.service.remove(+id);
  // }
}
