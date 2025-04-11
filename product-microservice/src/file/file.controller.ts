import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Query,
  Delete,
  Param,
  Get,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FileService } from './file.service';

@Controller('files')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Query('entityType') entityType: string,
    @Query('entityId') entityId: string,
    @Body() body: { isMain?: boolean; alt?: string; order?: number },
  ) {
    const savedFile = await this.fileService.saveFileMetadata(
      file.filename,
      `${entityType}/${entityId}/${file.filename}`,
      file.mimetype,
      entityType,
      parseInt(entityId),
      {
        isMain: body.isMain,
        alt: body.alt,
        order: body.order,
      },
    );

    return {
      id: savedFile.id,
      filename: savedFile.filename,
      path: savedFile.path,
      isMain: savedFile.isMain,
    };
  }

  @Get(':entityType/:entityId')
  async getFiles(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    return this.fileService.getFiles(entityType, parseInt(entityId));
  }

  @Delete(':id')
  async deleteFile(@Param('id') id: string) {
    await this.fileService.deleteFile(parseInt(id));
    return { success: true };
  }

  @Get()
  findAll() {
    return this.fileService.findAll();
  }
}
