import { Module } from '@nestjs/common';
import { FileService } from './file.service';
import { FileController } from './file.controller';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import * as path from 'path';
import { TypeOrmModule } from '@nestjs/typeorm';
import { File } from './entities/file.entity';

@Module({
  controllers: [FileController],
  imports: [
    TypeOrmModule.forFeature([File]),
    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const baseUploadPath = configService.get('UPLOAD_PATH') || 'uploads';

        return {
          storage: diskStorage({
            destination: (req, file, cb) => {
              // Determine entity type and ID from the URL path
              let entityType = 'misc';
              let entityId = 'unknown';
              let matches: RegExpMatchArray | null = null;
              // Check URL pattern to determine entity type
              if (req.url.startsWith('/product')) {
                entityType = 'products';

                // Extract product ID if it exists in the path
                matches = req.url.match(/\/product\/(\d+)/);
              } else if (req.url.startsWith('/category')) {
                entityType = 'categories';
                // Extract product ID if it exists in the path
                matches = req.url.match(/\/category\/(\d+)/);
              }
              if (matches && matches[1]) {
                entityId = matches[1];
              } else {
                entityId = 'new'; // For new products without ID yet
              }

              // Create nested directories
              const uploadPath = path.join(
                baseUploadPath,
                entityType,
                entityId,
              );

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
  providers: [FileService],
  exports: [FileService, MulterModule],
})
export class FileModule {}
