import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UnauthorizedException,
  Req,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CurrentUser } from 'src/decorators/current-user.decorator';
import { User } from './entities/user.entity';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}
  //check the authorization header validity and then return
  // the current user attached to the request by the guard
  @Get('current')
  // @UseGuards(JwtAuthGuard)
  async getCurrentUser(@Req() request: Request) {
    // Extract user ID from header
    const userId = request.headers['x-user-id'];
    if (!userId) {
      throw new UnauthorizedException('User ID not found');
    }
    // Get the data of the user
    const user = await this.userService.findOne(+userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    // Leave by destructuring unnecesarry data
    const { password, createdAt, updatedAt, active, ...userData } = user;
    console.log(user);
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
    console.log('get one');
    return this.userService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.update(+id, updateUserDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    console.log('delete one');
    return this.userService.remove(+id);
  }
}
