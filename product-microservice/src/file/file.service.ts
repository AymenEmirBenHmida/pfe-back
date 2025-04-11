import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { File } from './entities/file.entity';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FileService {
  constructor(
    @InjectRepository(File)
    private fileRepository: Repository<File>,
    private readonly configService: ConfigService,
  ) {}

  // This method would be called after Multer has saved the file
  async saveFileMetadata(
    filename: string,
    filepath: string,
    mimetype: string,
    entityType: string,
    entityId: number,
    options?: { isMain?: boolean; alt?: string; order?: number },
  ): Promise<File> {
    console.log('--- Saving File Metadata ---');
    console.log('Filename:', filename);
    console.log('Filepath:', filepath);
    console.log('Mimetype:', mimetype);
    console.log('Entity Type:', entityType);
    console.log('Entity ID:', entityId);
    console.log('Options:', options);
    console.log('-----------------------------');

    // Validate the entityType and entityId
    if (!entityType || !entityId) {
      throw new Error('Invalid entityType or entityId provided.');
    }

    // If this is the main file, update any existing main files for the same entity
    if (options?.isMain) {
      await this.fileRepository.update(
        { entityType, entityId, isMain: true },
        { isMain: false }, // Make the current file not the main one
      );
    }

    // Create new File instance and set its properties
    const file = new File();
    file.filename = filename;
    file.path = filepath;
    file.mimetype = mimetype;
    file.entityType = entityType;
    file.entityId = entityId;
    file.isMain = options?.isMain || false;
    file.alt = options?.alt || '';
    file.displayOrder = options?.order || 0;

    // Save the file in the database
    const savedFile = await this.fileRepository.save(file);

    console.log(
      'saved File inside of file service ',
      savedFile,
      '\n this is the createdFile before saving ',
      file,
    );

    return savedFile;
  }

  async saveMultipleFilesMetaData(
    images: Express.Multer.File[],
    id: string,
    uploadPath: string,
    entityType: string,
  ): Promise<File[]> {
    console.log('--- saveMultipleFilesMetaData called ---');
    console.log('Images received:', images);
    console.log('Entity ID:', id);
    console.log('Upload path:', uploadPath);

    const savedFiles: File[] = [];

    if (!images || images.length === 0) {
      console.warn('No images provided, skipping file save.');
      return savedFiles;
    }

    try {
      const results = await Promise.all(
        images.map((image, index) => {
          console.log(`Processing image ${index}:`, {
            filename: image.filename,
            mimetype: image.mimetype,
          });

          return this.saveFileMetadata(
            image.filename,
            `${uploadPath}/${id}/${image.filename}`,
            image.mimetype,
            entityType,
            parseInt(id),
            {
              isMain: index === 0,
              alt: 'Product image',
              order: index,
            },
          );
        }),
      );

      savedFiles.push(...results);
      console.log('✅ Files successfully saved:', savedFiles);
      return savedFiles;
    } catch (error) {
      console.error('❌ Error saving multiple files:', error);
      throw error;
    }
  }

  async getFiles(entityType: string, entityId: number): Promise<File[]> {
    return this.fileRepository.find({
      where: { entityType, entityId },
    });
  }
  findAll() {
    return this.fileRepository.find();
  }

  async deleteFile(id: number): Promise<void> {
    const file = await this.fileRepository.findOne({ where: { id } });
    if (!file) return;

    // Delete the file from storage
    const filePath = path.join(process.cwd(), file.path);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error('Error deleting file:', error);
    }

    await this.fileRepository.remove(file);
  }

  async deleteFileAndFolder(
    imageId: number,
    categoryId: number,
    entityType: string,
  ): Promise<void> {
    const uploadPath = this.configService.get('UPLOAD_PATH')! + entityType;
    const file = await this.fileRepository.findOne({ where: { id: imageId } });
    if (!file) return;

    // Delete the file from storage
    const fodlerPath = path.join(
      process.cwd(),
      uploadPath,
      categoryId.toString(),
    );
    console.log(fodlerPath);
    try {
      if (fs.existsSync(fodlerPath)) {
        fs.rmSync(fodlerPath, { recursive: true, force: true });
      }
    } catch (error) {
      console.error('Error deleting file:', error);
    }

    await this.fileRepository.remove(file);
  }
}
