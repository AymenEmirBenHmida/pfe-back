import { ImageService } from './../image/image.service';
import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { GetUserDto } from './dto/get-user.dto';
import { ClientKafka } from '@nestjs/microservices';

@Injectable()
export class UserService {
  logger: any;
  constructor(
    @InjectRepository(User) private usersRepository: Repository<User>,
    private imageService: ImageService,
    @Inject('KAFKA_USER_CLIENT') private readonly kafkaClient: ClientKafka,
  ) {}
  async create(createUserDto: CreateUserDto) {
    const createdUser = this.usersRepository.create({
      ...createUserDto,
      password: await bcrypt.hash(createUserDto.password, 10),
    });
    return await this.usersRepository.save(createdUser);
  }

  async findByEmail(email: string): Promise<User | null> {
    console.log(email);
    return await this.usersRepository.findOne({ where: { email } });
  }

  //checks the user availability and the correctness of the password
  async verifyUser(email: string, password: string) {
    //get the user by his email
    const user = await this.usersRepository.findOne({ where: { email } });
    //test the users availability and the correctness of the password
    if (user && (await bcrypt.compare(password, user.password))) {
      return user;
    } else {
      throw new UnauthorizedException('Credentials are not valid.');
    }
  }

  //find all users
  async findAll() {
    return await this.usersRepository.find();
  }

  //find one user by his id
  async findOne(id: number) {
    return this.usersRepository.findOne({ where: { id } });
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    //find the user to be updated
    const toBeUpdatedUser = await this.findOne(id);
    // Delete the old image if it exists
    if (
      toBeUpdatedUser?.profileImageUrl &&
      updateUserDto.profileImageUrl !== toBeUpdatedUser.profileImageUrl
    ) {
      const oldImagePath = toBeUpdatedUser.profileImageUrl;
      this.imageService.deletImage(oldImagePath);
    }
    //if not found throw exception
    if (!toBeUpdatedUser) {
      throw new NotFoundException();
    }
    //assign the value of the sent user to the user to be returned
    Object.assign(toBeUpdatedUser, updateUserDto);
    Logger.log(toBeUpdatedUser);
    //save the updated user and return him
    return await this.usersRepository.save(toBeUpdatedUser);
  }

  async remove(id: number) {
    const userToBeDeleted = await this.findOne(id);
    if (!userToBeDeleted) {
      throw new NotFoundException();
    }
    const deletedUser = await this.usersRepository.remove(userToBeDeleted);
    this.kafkaClient.emit('user.deleted', deletedUser.id);
    return deletedUser;
  }

  async getUser(getUserDto: GetUserDto) {
    return await this.usersRepository.findOne({
      where: { ...getUserDto, id: +getUserDto.id },
    });
  }
  async findUserByEmail(email: string) {
    return this.usersRepository.findOne({ where: { email } });
  }

  async updatePassword(userId: string, password: string) {
    try {
      const user = await this.usersRepository.findOne({
        where: { id: +userId },
      });

      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // Hash password with bcrypt
      const hashedPassword = await bcrypt.hash(password, 10);
      await this.usersRepository.update(user.id, { password: hashedPassword });

      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to update password: ${error.message}`);
      return { success: false, error: 'Internal server error' };
    }
  }

  async updateProfileImage(userId: string, imagePath: string) {
    try {
      const user = await this.usersRepository.findOne({
        where: { id: +userId },
      });
      if (!user) {
        throw new NotFoundException('User not found');
      }
      user.profileImageUrl = imagePath;
      await this.usersRepository.save(user);
      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to update profile image: ${error.message}`);
      return { success: false, error: 'Internal server error' };
    }
  }
}
