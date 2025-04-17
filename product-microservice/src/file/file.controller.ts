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
import { ApiBody, ApiConsumes, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
@ApiTags('Files')
@Controller('files')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a file and save its metadata' })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({ name: 'entityType', type: String })
  @ApiQuery({ name: 'entityId', type: String })
  @ApiBody({
    description: 'File and its metadata',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        isMain: {
          type: 'boolean',
          example: true,
        },
        alt: {
          type: 'string',
          example: 'Front view image',
        },
        order: {
          type: 'number',
          example: 1,
        },
      },
    },
  })
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
  @ApiOperation({ summary: 'Get files by entity type and entity ID' })
  @ApiParam({ name: 'entityType', type: String })
  @ApiParam({ name: 'entityId', type: Number })
  async getFiles(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    return this.fileService.getFiles(entityType, parseInt(entityId));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a file by ID' })
  @ApiParam({ name: 'id', type: Number })
  async deleteFile(@Param('id') id: string) {
    await this.fileService.deleteFile(parseInt(id));
    return { success: true };
  }

  @Get()
  @ApiOperation({ summary: 'Get all files' })
  findAll() {
    return this.fileService.findAll();
  }
}
