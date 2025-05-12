import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ClientKafka
} from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { File } from 'src/file/entities/file.entity';
import { FileService } from 'src/file/file.service';
import { Repository } from 'typeorm';
import { CategoryService } from './../category/category.service';
import { AddProductImagesDto } from './dto/add-product-images.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product } from './entities/product.entity';

@Injectable()
export class ProductService implements OnModuleInit {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Product) private productsRepository: Repository<Product>,
    private readonly fileService: FileService,
    private readonly categoryService: CategoryService,
    @Inject('KAFKA_PRODUCT_CLIENT') private readonly kafkaClient: ClientKafka,
  ) {}
  /**
   * Initializes Kafka connections and topic subscriptions
   * Called when the module is initialized
   */
  async onModuleInit() {
    // Make sure we're subscribed to these topics
    const requiredTopics = [
      'product.getProductsByIds.reply',
      'product.getProductsByIds',
    ];

    requiredTopics.forEach((topic) => {
      console.log('subscribed to topic', topic);
      this.kafkaClient.subscribeToResponseOf(topic);
    });

    try {
      await this.kafkaClient.connect();
    } catch (error) {
      console.log('Failed to connect to Kafka', error);
    }
  }
  // Ensure productId is valid
  private isValidProductId(productId: any): boolean {
    return !isNaN(Number(productId)) && Number(productId) > 0;
  }

  async create(createProductDto: CreateProductDto) {
    const newProduct = await this.productsRepository.save(createProductDto);
    if (!newProduct) throw new NotFoundException();
    return newProduct;
  }
  async getProductsByIds(ids: number[]) {
    const products = await this.productsRepository.findByIds(ids.map(Number));
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

  async uploadProductImages(
    productId: number,
    files: Express.Multer.File[],
    imageList: AddProductImagesDto,
  ) {
    if (!this.isValidProductId(productId)) {
      throw new NotFoundException(`Invalid productId: ${productId}`);
    }

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
    sortOrder = 'DESC',
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
    const enriched = await Promise.all(
      items.map(async (product) => {
        let images: File[] = [];
        if (product.files && product.files.length > 0) {
          images = await this.fileService.getFilesWithIds(
            product.files.map(Number),
          );
        }
        const category = await this.categoryService.findOne(product.categoryId);
        return {
          ...product,
          category,
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
    if (!this.isValidProductId(id)) {
      throw new NotFoundException(`Invalid productId: ${id}`);
    }

    const product = await this.productsRepository.findOne({ where: { id } });
    if (!product) throw new NotFoundException();

    const imageIds = product.files?.map(Number) || [];
    const images = await this.fileService.getFilesWithIds(imageIds);

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
    if (!this.isValidProductId(id)) {
      throw new NotFoundException(`Invalid productId: ${id}`);
    }

    const toBeUpdatedProduct = await this.findOne(id);
    if (!toBeUpdatedProduct) throw new NotFoundException();
    Object.assign(toBeUpdatedProduct, updateProductDto);
    const uploadPath = this.configService.get('UPLOAD_PATH')!;
    const updatedProduct =
      await this.productsRepository.save(toBeUpdatedProduct);

    if (images) {
      const savedFiles = await this.fileService.saveMultipleFilesMetaData(
        images,
        toBeUpdatedProduct.id + '',
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
    if (!this.isValidProductId(id)) {
      throw new NotFoundException(`Invalid productId: ${id}`);
    }

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

  async findProductsByIds(productIds: string[]): Promise<Product[]> {
    try {
      const validProductIds = productIds.filter(this.isValidProductId);

      if (validProductIds.length !== productIds.length) {
        throw new Error('Some product IDs are invalid');
      }

      const products = await this.productsRepository.findByIds(
        validProductIds.map(Number),
      );

      // Use Promise.all to wait for async inside map
      const productWithImages = await Promise.all(
        products.map(async (product) => {
          const imageIds = product.files?.map(Number) || [];
          const images = await this.fileService.getFilesWithIds(imageIds);

          return {
            ...product,
            images,
          };
        }),
      );

      return productWithImages;
    } catch (error) {
      console.error('Error in findProductsByIds:', error);
      throw new Error('Failed to find products by IDs');
    }
  }

  async decreaseStock(productId: number, quantity: number) {
    if (!this.isValidProductId(productId)) {
      throw new NotFoundException(`Invalid productId: ${productId}`);
    }

    const product = await this.productsRepository.findOneBy({ id: productId });
    if (!product) throw new NotFoundException('Product not found');
    product.stock -= quantity;
    await this.productsRepository.save(product);
  }
}
