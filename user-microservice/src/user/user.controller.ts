import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  InternalServerErrorException,
  Logger,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
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
  ApiQuery,
} from '@nestjs/swagger';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { Role } from './enums/role.enum';

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

  // Advanced filtering endpoint for users
  @Get('filter')
  async findAllFiltered(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('role') role?: Role,
    @Query('active') active?: boolean,
    @Query('location') location?: string,
    @Query('companyName') companyName?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('sortBy', new DefaultValuePipe('createdAt')) sortBy?: string,
    @Query('sortOrder', new DefaultValuePipe('DESC')) sortOrder?: string,
  ) {
    Logger.log(`Filtering users - page: ${page}, limit: ${limit}`);

    return this.userService.findAllFiltered({
      page,
      limit,
      search,
      role,
      active: active !== undefined ? Boolean(active) : undefined,
      location,
      companyName,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      sortBy,
      sortOrder,
    });
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

  @Patch(':id/images')
  @UseInterceptors(FileInterceptor('profileImage'))
  @ApiOperation({ summary: 'insert user image' })
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
  async addUserImage(
    @Param('id') id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    // Update the user
    return await this.userService.addImage(+id, file);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete user' })
  @ApiParam({ name: 'id', example: 1 })
  remove(@Param('id') id: string) {
    return this.userService.remove(+id);
  }

  // @MessagePattern('user.getUsersByIds')
  // async getUsersByIds(@Payload() data: { ids: number[] }) {
  //   return this.userService.getUsersByIds(data.ids);
  // }

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
