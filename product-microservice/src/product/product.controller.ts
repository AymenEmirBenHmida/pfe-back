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
  UploadedFiles,
  Query,
  Logger,
  Req,
} from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { AddProductImagesDto } from './dto/add-product-images.dto';
import { Request } from 'express';

@Controller('product')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  create(@Body() createProductDto: CreateProductDto) {
    return this.productService.create(createProductDto);
  }
  // Gotta fiw up that when there is a problem the file is still saved
  @Post(':id/images')
  @UseInterceptors(FilesInterceptor('productImages'))
  addProductImages(
    @Param('id') id: string,
    @Body() body: any,
    @UploadedFiles() images: Express.Multer.File[],
  ) {
    console.log(images);
    console.log(body.images);
    const parsedlist: AddProductImagesDto = {
      images: JSON.parse(body.images),
    };
    console.log('parsed body ', parsedlist);
    return this.productService.uploadProductImages(+id, images, parsedlist);
  }

  @Get()
  findAll(
    @Req() request: Request,

    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('search') search: string,
    @Query('category') category: string,
    @Query('minPrice') minPrice: string,
    @Query('maxPrice') maxPrice: string,
    @Query('characteristics') characteristics: string, // Pass as JSON string
    @Query('sortBy') sortBy: string,
    @Query('sortOrder') sortOrder: string,
  ) {
    return this.productService.findAllFilter({
      page: Number(page) || 1,
      limit: Number(limit) || 10,
      search,
      category,
      minPrice: minPrice ? parseFloat(minPrice) : undefined,
      maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
      characteristics: characteristics
        ? JSON.parse(characteristics)
        : undefined,
      sortBy,
      sortOrder,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productService.update(+id, updateProductDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productService.remove(+id);
  }
}
