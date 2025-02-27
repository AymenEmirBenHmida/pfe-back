import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { GetUserDto } from './dto/get-user.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private usersRepository: Repository<User>,
  ) {}
  async create(createUserDto: CreateUserDto) {
    const createdUser = this.usersRepository.create({
      ...createUserDto,
      password: await bcrypt.hash(createUserDto.password, 10),
    });
    return await this.usersRepository.save(createdUser);
  }
  // Add this missing method
  async findByEmail(email: string): Promise<User | null> {
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

  async findAll() {
    //find all users
    return await this.usersRepository.find();
  }

  async findOne(id: number) {
    //find one user by his id
    return this.usersRepository.findOne({ where: { id } });
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    //find the user to be updated
    const toBeUpdatedUser = await this.findOne(id);
    //if not found throw exception
    if (!toBeUpdatedUser) {
      throw new NotFoundException();
    }
    //assign the value of the sent user to the user to be returned
    Object.assign(toBeUpdatedUser, updateUserDto);
    //save the updated user and return him
    return await this.usersRepository.save(toBeUpdatedUser);
  }

  async remove(id: number) {
    const userToBeDeleted = await this.findOne(id);
    if (!userToBeDeleted) {
      throw new NotFoundException();
    }
    return await this.usersRepository.remove(userToBeDeleted);
  }

  async getUser(getUserDto: GetUserDto) {
    return await this.usersRepository.findOne({
      where: { ...getUserDto, id: +getUserDto.id },
    });
  }
}
