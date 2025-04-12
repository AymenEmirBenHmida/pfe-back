import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Category } from './entities/category.entity';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { FileService } from 'src/file/file.service';

@Injectable()
export class CategoryService {
  constructor(
    @InjectRepository(Category)
    private categoriesRepository: Repository<Category>,
    private readonly configService: ConfigService,
    private readonly fileService: FileService,
  ) {}
  create(createCategoryDto: CreateCategoryDto) {
    return this.categoriesRepository.save(createCategoryDto);
  }

  async uploadCategoryImage(id: number, image: Express.Multer.File) {
    const uploadPath = this.configService.get('UPLOAD_PATH')! + 'categories';

    // Step 1: Find the category
    const category = await this.findOne(id);
    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }
    // Step 1.5: Delete the existing image if there's any
    if (category.imageId) {
      await this.fileService.deleteFile(category.imageId);
    }

    // Step 2: Save the uploaded file metadata
    const savedFile = await this.fileService.saveFileMetadata(
      image.filename,
      `${uploadPath}/${id}/${image.filename}`,
      image.mimetype,
      'Category',
      id,
    );

    // Step 3: Assign the saved file as the category's image
    category.imageId = savedFile.id;
    console.log(category);
    // Step 4: Persist the updated category
    const updatedCategory = await this.categoriesRepository.save(category);

    return {...updatedCategory,image:savedFile};
  }

  async findAll() {
    const categories = await this.categoriesRepository.find();

    const enriched = await Promise.all(
      categories.map(async (category) => {
        const image = await this.fileService.getFiles('Category', category.id);
        return {
          ...category,
          image,
        };
      }),
    );

    return enriched;
  }
  
  async findAllFiltered(query: {
    name?: string;
    isActive?: string;
    page?: number;
    limit?: number;
  }) {
    const { name, isActive, page = 1, limit = 10 } = query;

    const qb = this.categoriesRepository.createQueryBuilder('category');

    if (name) {
      qb.andWhere('category.name ILIKE :name', { name: `%${name}%` });
    }

    if (isActive !== undefined) {
      qb.andWhere('category.isActive = :isActive', { isActive: isActive === 'true' });
    }

    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
    };
  }

  // Find category by ID with image
  async findOne(id: number) {
    const category = await this.categoriesRepository.findOne({ where: { id } });

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    // Retrieve the image related to the category
    const image = await this.fileService.getFileWithId(category.id);
    return {
      ...category,
      image,
    };
  }
  // Update category
  async update(
    id: number,
    updateCategoryDto: UpdateCategoryDto,
    // image: Express.Multer.File,
  ) {
    const categoryToBeUpdated = await this.findOne(id);
    // const uploadPath = this.configService.get('UPLOAD_PATH')! + 'categories';

    if (!categoryToBeUpdated) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    // // If the update contains a new image, handle it
    // if (image) {
    //   // Step 1: Delete the existing image if there's any
    //   if (categoryToBeUpdated.imageId) {
    //     await this.fileService.deleteFile(categoryToBeUpdated.imageId);
    //   }

    //   // Step 2: Save the uploaded file metadata
    //   const savedFile = await this.fileService.saveFileMetadata(
    //     image.filename,
    //     `${uploadPath}/${id}/${image.filename}`,
    //     image.mimetype,
    //     'Category',
    //     id,
    //   );
    //   // Step 3: Assign the new image (assuming image contains a valid file ID)
    //   categoryToBeUpdated.imageId = savedFile.id;
    // }

    // Update the rest of the category details
    Object.assign(categoryToBeUpdated, updateCategoryDto);
    // Retrieve the image related to the category
    const image = await this.fileService.getFileWithId(categoryToBeUpdated.id);
      // Step 3: Save the updated category
    const updatedCtagory = await this.categoriesRepository.save(categoryToBeUpdated);
  
    return {...updatedCtagory,image};
  }

  // Delete category by ID and remove associated image
  async remove(id: number) {
    const categoryToBeDeleted = await this.findOne(id);

    if (!categoryToBeDeleted) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }
    console.log('category to be deleted');
    console.log(categoryToBeDeleted);
    // Step 1: Delete the image associated with the category
    if (categoryToBeDeleted.imageId) {
      await this.fileService.deleteFileAndFolder(
        categoryToBeDeleted.imageId,
        categoryToBeDeleted.id,
        'categories',
      ); // Delete the image
    }

    // Step 2: Delete the category
    return this.categoriesRepository.remove(categoryToBeDeleted);
  }
}
