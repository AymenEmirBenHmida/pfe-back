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
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { MessagePattern, Payload, Transport } from '@nestjs/microservices';

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
  @ApiOperation({ summary: 'Upload product images' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'id', type: Number, description: 'ID of the product' })
  @ApiBody({
    description: 'FormData with product images and their metadata',
    schema: {
      type: 'object',
      properties: {
        productImages: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
        images: {
          type: 'string',
          example:
            '[{ "order": 1,"isOld":true,"id":5 }, { "order": 2,"isOld":false }]',
        },
      },
    },
  })
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
  @ApiOperation({ summary: 'Filter and get all products' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiQuery({ name: 'minPrice', required: false, type: Number })
  @ApiQuery({ name: 'maxPrice', required: false, type: Number })
  @ApiQuery({
    name: 'characteristics',
    required: false,
    type: String,
    description: 'JSON string',
  })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, type: String })
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
  @ApiOperation({ summary: 'Get a product by ID' })
  @ApiParam({ name: 'id', type: Number })
  findOne(@Param('id') id: string) {
    return this.productService.findOne(+id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update product by ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ type: UpdateProductDto })
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productService.update(+id, updateProductDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete product by ID' })
  @ApiParam({ name: 'id', type: Number })
  remove(@Param('id') id: string) {
    return this.productService.remove(+id);
  }
  @MessagePattern('order.created', Transport.KAFKA)
  async handleOrderCreated(@Payload() data: any) {
    const orderedItems = data.items;
    for (const item of orderedItems) {
      await this.productService.decreaseStock(item.productId, item.quantity);
    }
  }
}
