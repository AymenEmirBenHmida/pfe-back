import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UploadedFile,
  UseInterceptors,
  Query,
} from '@nestjs/common';
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('category')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Post()
  create(@Body() createCategoryDto: CreateCategoryDto) {
    return this.categoryService.create(createCategoryDto);
  }
  @Post(':id/images')
  @UseInterceptors(FileInterceptor('categoryImage'))
  addProductImages(
    @Param('id') id: string,
    @UploadedFile() image: Express.Multer.File,
  ) {
    console.log(image);
    return this.categoryService.uploadCategoryImage(+id, image);
  }

  // @Get()
  // findAll() {
  //   return this.categoryService.findAll();
  // }
  @Get()
  findAll(
    @Query('name') name?: string,
    @Query('isActive') isActive?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.categoryService.findAllFiltered({
      name,
      isActive,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.categoryService.findOne(+id);
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('categoryImage'))
  update(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
    // @UploadedFile() image: Express.Multer.File,
  ) {
    return this.categoryService.update(+id, updateCategoryDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.categoryService.remove(+id);
  }
}
