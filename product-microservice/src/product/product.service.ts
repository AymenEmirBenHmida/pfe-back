import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { Repository } from 'typeorm';
import { FileService } from 'src/file/file.service';
import { AddProductImagesDto } from './dto/add-product-images.dto';

@Injectable()
export class ProductService {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Product) private productsRepository: Repository<Product>,
    private readonly fileService: FileService,
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
    // createProductDto: CreateProductDto,
    productId: number,
    files: Express.Multer.File[],
    imageList: AddProductImagesDto,
  ) {
    const product = await this.productsRepository.findOne({
      where: { id: productId },
    });
    if (!product) throw new NotFoundException();

    const uploadPath = this.configService.get('UPLOAD_PATH')! + '/products';
    console.log(files);
    const orderedFileIds: number[] = [];
    console.log('imageList = ', imageList);
    console.log('productId = ', productId);
    let fileIndex = 0;
    imageList.images =
      typeof imageList.images === 'string'
        ? JSON.parse(imageList.images)
        : imageList.images;
    console.log('image list length ', imageList.images.length);
    for (const image of imageList.images) {
      console.log(fileIndex);
      if (image.isOld && image.id) {
        orderedFileIds.push(image.id);
      } else {
        const uploadedFile = files[fileIndex];
        fileIndex++;
        console.log('uploaded file :', uploadedFile);
        const saved = await this.fileService.saveFileMetadata(
          uploadedFile.filename,
          uploadedFile.path,
          uploadedFile.mimetype,
          (typeof product).toString(),
          productId,
          {order:image.order}
        );
        orderedFileIds.push(saved.id);
      }
    }

    // Clean up removed old files
    const previousIds = product.files || [];
    const removed = previousIds.filter((fid) => !orderedFileIds.includes(+fid));
    for (const idToRemove of removed) {
      await this.fileService.deleteFileAndFolder(
        +idToRemove,
        productId,
        'products',
      );
    }

    product.files = orderedFileIds.map(String);
    return this.productsRepository.save(product);
  }

  async findAll() {
    const products = await this.productsRepository.find();
    if (!products) throw new NotFoundException();
    const enriched = await Promise.all(
      products.map(async (product) => {
        const images = await this.fileService.getFiles('Product', product.id);
        return {
          ...product,
          images,
        };
      }),
    );

    return enriched;
  }

  async findOne(id: number) {
    const product = await this.productsRepository.findOne({ where: { id } });
    if (!product) throw new NotFoundException();
    const images = await this.fileService.getFiles('Product', product.id);
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
        uploadPath + '/products',
        'Product',
      );
      return {
        ...updatedProduct,
        files: savedFiles,
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
    return await this.productsRepository.remove(productToBeRemoved);
  }
}
