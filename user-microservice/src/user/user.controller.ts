import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  InternalServerErrorException,
  Logger,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { existsSync } from 'fs';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserService } from './user.service';
import { ConfigService } from '@nestjs/config';

@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly configService: ConfigService,
  ) {}

  @Get('current')
  async getCurrentUser(@Req() request: Request) {
    const userId = request.headers['x-user-id'];
    if (!userId) {
      throw new UnauthorizedException('User ID not found');
    }

    const user = await this.userService.findOne(+userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const { password, createdAt, updatedAt, active, ...userData } = user;
    return userData;
  }

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  @Get()
  findAll() {
    return this.userService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userService.findOne(+id);
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('profileImage'))
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    // Create a copy of updateUserDto to avoid modifying the original
    const updateData = { ...updateUserDto };
    console.log(file);
    Logger.log('hello');
    Logger.log(`File received: ${JSON.stringify(file)}`);
    if (file) {
      // Log the file for debugging
      Logger.log(`File received: ${JSON.stringify(file)}`);

      // Create a web-accessible URL path for the frontend
      const webPath = `/uploads/profiles/${file.filename}`;

      // Store the file path in both fields for backward compatibility
      updateData.profileImageUrl = webPath;

      Logger.log(`Storing image path as: ${webPath}, file path: ${file.path}`);
    }

    // Update the user
    return await this.userService.update(+id, updateData);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.userService.remove(+id);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadProfileImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No image file uploaded');
    }

    try {
      const fileExists = existsSync(file.path);
      if (!fileExists) {
        throw new InternalServerErrorException('File was not saved properly');
      }

      return {
        success: true,
        message: 'File uploaded successfully',
        fileDetails: {
          filename: file.filename,
          originalName: file.originalname,
          size: file.size,
          mimetype: file.mimetype,
          path: file.path,
        },
      };
    } catch (error) {
      throw new InternalServerErrorException(
        `Error processing uploaded file: ${error.message}`,
      );
    }
  }
}
