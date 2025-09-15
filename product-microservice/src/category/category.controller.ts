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
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { Category } from './entities/category.entity';
import { CategoryFilterDto } from './dto/category-filter.dto';

@Controller('category')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Post()
  @ApiBody({ type: CreateCategoryDto })
  @ApiOperation({ summary: 'Create a new category' })
  @ApiCreatedResponse({ type: Category })
  create(@Body() createCategoryDto: CreateCategoryDto) {
    return this.categoryService.create(createCategoryDto);
  }

  @Post(':id/images')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Upload category image',
    schema: {
      type: 'object',
      properties: {
        categoryImage: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiParam({ name: 'id', type: 'string', description: 'Category ID' })
  @ApiOperation({ summary: 'Upload an image for a category' })
  @UseInterceptors(FileInterceptor('categoryImage'))
  addProductImages(
    @Param('id') id: string,
    @UploadedFile() image: Express.Multer.File,
  ) {
    console.log(image);
    return this.categoryService.uploadCategoryImage(+id, image);
  }

  @Get()
  @ApiOperation({ summary: 'Get all categories with optional filters' })
  findAll(@Query() filterDto: CategoryFilterDto) {
    return this.categoryService.findAllFiltered(filterDto);
  }
  @Get(':id')
  @ApiOperation({ summary: 'Get a single category depending on its id' })
  @ApiQuery({
    name: 'id',
    required: true,
    type: String,
    description: 'Get by category id',
  })
  findOne(@Param('id') id: string) {
    return this.categoryService.findOne(+id);
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('categoryImage'))
  @ApiOperation({ summary: 'Update a category by ID' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID of the category to update',
  })
  @ApiBody({
    description: 'Updated category data with optional image',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Updated Category Name' },
        isActive: { type: 'boolean', example: true },
        categoryImage: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiOkResponse({ description: 'The category was successfully updated.' })
  @ApiNotFoundResponse({ description: 'Category not found.' })
  update(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
    // @UploadedFile() image?: Express.Multer.File,
  ) {
    return this.categoryService.update(+id, updateCategoryDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a category by ID' })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID of the category to delete',
  })
  @ApiOkResponse({ description: 'Category deleted successfully.' })
  @ApiNotFoundResponse({ description: 'Category not found.' })
  remove(@Param('id') id: string) {
    return this.categoryService.remove(+id);
  }
}
