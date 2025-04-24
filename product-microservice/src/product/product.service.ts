import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { Repository } from 'typeorm';
import { FileService } from 'src/file/file.service';
import { AddProductImagesDto } from './dto/add-product-images.dto';
import { File } from 'src/file/entities/file.entity';
import { ClientKafka } from '@nestjs/microservices';

@Injectable()
export class ProductService {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Product) private productsRepository: Repository<Product>,
    private readonly fileService: FileService,
    @Inject('KAFKA_PRODUCT_CLIENT') private readonly kafkaClient: ClientKafka,
  ) {}
  async create(
    createProductDto: CreateProductDto,
    // images: Express.Multer.File[],
  ) {
    // const uploadPath = this.configService.get('UPLOAD_PATH')!;

    const newProduct = await this.productsRepository.save(createProductDto);
    if (!newProduct) throw new NotFoundException();
    // let savedFiles = this.fileService.saveMultipleFilesMetaData(
    //   images,
    //   newProduct.id + '',
    //   uploadPath,
    // );
    // console.log('saved files in product create service ', savedFiles);

    return newProduct;

    // files: savedFiles,
  }
  async uploadProductImages(
    productId: number,
    files: Express.Multer.File[],
    imageList: AddProductImagesDto,
  ) {
    const product = await this.productsRepository.findOne({
      where: { id: productId },
    });
    if (!product) throw new NotFoundException();

    imageList.images =
      typeof imageList.images === 'string'
        ? JSON.parse(imageList.images)
        : imageList.images;

    const allImagesWithIds: { order: number; id: number }[] = [];
    let fileIndex = 0;

    for (const image of imageList.images) {
      if (image.isOld && image.id) {
        allImagesWithIds.push({ order: image.order, id: image.id });
      } else {
        const uploadedFile = files[fileIndex++];
        const saved = await this.fileService.saveFileMetadata(
          uploadedFile.filename,
          uploadedFile.path,
          uploadedFile.mimetype,
          'Product',
          productId,
          { order: image.order },
        );
        allImagesWithIds.push({ order: image.order, id: saved.id });
      }
    }

    // Sort all images by order before saving
    const orderedFileIds = allImagesWithIds
      .sort((a, b) => a.order - b.order)
      .map((img) => img.id);

    // Remove old files that are not in the new list
    const previousIds = product.files || [];
    const removed = previousIds.filter((fid) => !orderedFileIds.includes(+fid));
    for (const idToRemove of removed) {
      await this.fileService.deleteFile(+idToRemove);
    }

    product.files = orderedFileIds.map(String);
    return this.productsRepository.save(product);
  }

  async findAll() {
    const products = await this.productsRepository.find();
    if (!products) throw new NotFoundException();
    const enriched = await Promise.all(
      products.map(async (product) => {
        const images = await this.fileService.getFilesWithIds(
          product.files.map(Number),
        );
        return {
          ...product,
          images,
        };
      }),
    );

    return enriched;
  }
  async findAllFilter({
    page,
    limit,
    search,
    category,
    minPrice,
    maxPrice,
    characteristics,
    sortBy = 'createdAt',
    sortOrder = 'DESC', // Default: latest products
  }: {
    page: number;
    limit: number;
    search?: string;
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    characteristics?: Record<string, string>;
    sortBy?: string;
    sortOrder?: string;
  }) {
    const query = this.productsRepository.createQueryBuilder('product');
    if (search) {
      query.andWhere('product.name ILIKE :search', { search: `%${search}%` });
    }

    if (category) {
      query.andWhere('product.categoryId = :category', {
        category: Number(category),
      });
    }

    if (minPrice !== undefined) {
      query.andWhere('product.price >= :minPrice', { minPrice });
    }

    if (maxPrice !== undefined) {
      query.andWhere('product.price <= :maxPrice', { maxPrice });
    }

    if (characteristics) {
      for (const [key, value] of Object.entries(characteristics)) {
        query.andWhere(
          `product.characteristics ->> :key_${key} ILIKE :val_${key}`,
          {
            [`key_${key}`]: key,
            [`val_${key}`]: `%${value}%`,
          },
        );
      }
    }
    Logger.log('sort order ', sortOrder, ' sort by ', sortBy);
    query.orderBy(
      `product.${sortBy}`,
      sortOrder.toUpperCase() as 'ASC' | 'DESC',
    );

    query.skip((page - 1) * limit).take(limit);

    const [items, total] = await query.getManyAndCount();
    let images: File[];
    const enriched = await Promise.all(
      items.map(async (product) => {
        if (product.files && product.files.length > 0) {
          images = await this.fileService.getFilesWithIds(
            product.files.map(Number),
          );
        }
        return {
          ...product,
          images,
        };
      }),
    );
    return {
      data: enriched,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: number) {
    const product = await this.productsRepository.findOne({ where: { id } });
    if (!product) throw new NotFoundException();

    const imageIds = product.files?.map(Number) || [];
    const images = await this.fileService.getFilesWithIds(imageIds);

    // Optional: Remove file IDs from the response if you don't want to expose them

    return {
      ...product,
      images,
    };
  }

  async update(
    id: number,
    updateProductDto: UpdateProductDto,
    images?: Express.Multer.File[],
  ) {
    const toBeUpdatedProduct = await this.findOne(id);
    if (!toBeUpdatedProduct) throw new NotFoundException();
    Object.assign(toBeUpdatedProduct!, updateProductDto);
    const uploadPath = this.configService.get('UPLOAD_PATH')!;
    const updatedProduct = await this.productsRepository.save(
      toBeUpdatedProduct!,
    );
    if (images) {
      let savedFiles = this.fileService.saveMultipleFilesMetaData(
        images,
        toBeUpdatedProduct!.id + '',
        uploadPath + 'products',
        'Product',
      );
      return {
        ...updatedProduct,
        images: savedFiles,
      };
    }
    return {
      ...updatedProduct,
    };
  }

  async remove(id: number) {
    const productToBeRemoved = await this.findOne(id);
    if (!productToBeRemoved) throw new NotFoundException();
    if (productToBeRemoved.files.length > 0) {
      await this.fileService.deleteFileAndFolder(
        +productToBeRemoved.files[0],
        productToBeRemoved.id,
        'products',
      );
    }
    const removedProduct =
      await this.productsRepository.remove(productToBeRemoved);
    this.kafkaClient.emit('product.deleted', removedProduct.id);
    return removedProduct;
  }
}
