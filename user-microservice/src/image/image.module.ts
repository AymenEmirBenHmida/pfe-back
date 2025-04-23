import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { ImageService } from './image.service';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import * as path from 'path';

@Module({
  imports: [
    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const uploadPath = configService.get('UPLOAD_PATH')!;

        return {
          storage: diskStorage({
            destination: (req, file, cb) => {
              if (!existsSync(uploadPath)) {
                mkdirSync(uploadPath, { recursive: true });
              }
              cb(null, uploadPath);
            },
            filename: (req, file, cb) => {
              const uniqueSuffix =
                Date.now() + '-' + Math.round(Math.random() * 1e9);
              const extension = path.extname(file.originalname);
              cb(null, `${file.fieldname}-${uniqueSuffix}${extension}`);
            },
          }),
          limits: {
            fileSize: 5 * 1024 * 1024, // 5MB limit
          },
          fileFilter: (req, file, cb) => {
            if (!file.mimetype.match(/^image\/(jpeg|png|gif|webp)$/)) {
              return cb(new Error('Only image files are allowed!'), false);
            }
            cb(null, true);
          },
        };
      },
    }),
  ],
  providers: [ImageService],
  exports: [ImageService, MulterModule],
})
export class ImageModule {}
