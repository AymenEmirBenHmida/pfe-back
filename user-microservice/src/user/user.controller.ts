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
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiBody,
  ApiConsumes,
} from '@nestjs/swagger';

@ApiTags('Users')
@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly configService: ConfigService,
  ) {}
  @ApiOperation({ summary: 'Get current logged-in user' })
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
  @ApiOperation({ summary: 'Create a new user' })
  @ApiBody({ type: CreateUserDto })
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  @Get()
  @ApiOperation({ summary: 'Find all users' })
  findAll() {
    return this.userService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Find user by ID' })
  @ApiParam({ name: 'id', example: 1 })
  findOne(@Param('id') id: string) {
    return this.userService.findOne(+id);
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('profileImage'))
  @ApiOperation({ summary: 'Update user info' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        profileImage: { type: 'string', format: 'binary' },
        name: { type: 'string', example: 'New Name' },
      },
    },
  })
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
  @ApiOperation({ summary: 'Delete user' })
  @ApiParam({ name: 'id', example: 1 })
  remove(@Param('id') id: string) {
    return this.userService.remove(+id);
  }

  @Post('upload')
  @ApiOperation({ summary: 'Upload profile image' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
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
