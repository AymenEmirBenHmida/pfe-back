import { ImageService } from './../image/image.service';
import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
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
import { UserController } from './user.controller';
import { Role } from './enums/role.enum';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserController.name);

  constructor(
    @InjectRepository(User) private usersRepository: Repository<User>,
    private imageService: ImageService,
    @Inject('KAFKA_USER_CLIENT') private readonly kafkaClient: ClientKafka,
  ) {}
  // async onModuleInit() {
  //   this.logger.log('Registering as consumer for Kafka topics');

  //   // Make sure we're subscribed to these topics
  //   const requiredTopics = ['user.getUsersByIds'];

  //   requiredTopics.forEach((topic) => {
  //     this.logger.debug(`Subscribing to topic: ${topic}`);
  //     this.kafkaClient.subscribeToResponseOf(topic);
  //   });

  //   try {
  //     await this.kafkaClient.connect();
  //     this.logger.log('Successfully connected to Kafka');
  //   } catch (error) {
  //     this.logger.error(
  //       `Failed to connect to Kafka: ${error.message}`,
  //       error.stack,
  //     );
  //   }
  // }
  async addImage(userId: number, file?: Express.Multer.File) {
    const userToBeUpdated = await this.findOne(userId);
    if (!userToBeUpdated) {
      throw new NotFoundException(`Invalid user`);
    }
    Logger.log('hello');
    Logger.log(`File received: ${JSON.stringify(file)}`);
    if (file) {
      // Log the file for debugging
      Logger.log(`File received: ${JSON.stringify(file)}`);

      // Create a web-accessible URL path for the frontend
      const webPath = `/uploads/profiles/${file.filename}`;
      if (
        userToBeUpdated?.profileImageUrl &&
        userToBeUpdated.profileImageUrl !== webPath
      ) {
        const oldImagePath = userToBeUpdated.profileImageUrl;
        this.imageService.deletImage(oldImagePath);
      }
      // Store the file path in both fields for backward compatibility
      userToBeUpdated.profileImageUrl = webPath;

      Logger.log(`Storing image path as: ${webPath}, file path: ${file.path}`);
    }
    return this.usersRepository.save(userToBeUpdated);
  }

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

  // Advanced filtering method for users
  async findAllFiltered({
    page,
    limit,
    search,
    role,
    active,
    location,
    companyName,
    startDate,
    endDate,
    sortBy = 'createdAt',
    sortOrder = 'DESC',
  }: {
    page: number;
    limit: number;
    search?: string;
    role?: Role;
    active?: boolean;
    location?: string;
    companyName?: string;
    startDate?: Date;
    endDate?: Date;
    sortBy?: string;
    sortOrder?: string;
  }) {
    const query = this.usersRepository.createQueryBuilder('user');

    // Search in multiple columns (name, email, phoneNumber)
    if (search) {
      query.andWhere(
        '(user.name ILIKE :search OR user.email ILIKE :search OR user.phoneNumber ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    // Filter by role
    if (role) {
      query.andWhere('user.role = :role', { role });
    }

    // Filter by active status
    if (active !== undefined) {
      query.andWhere('user.active = :active', { active });
    }

    // Filter by location
    if (location) {
      query.andWhere('user.location ILIKE :location', {
        location: `%${location}%`,
      });
    }

    // Filter by company name
    if (companyName) {
      query.andWhere('user.companyName ILIKE :companyName', {
        companyName: `%${companyName}%`,
      });
    }

    // Date range filtering
    if (startDate) {
      query.andWhere('user.createdAt >= :startDate', { startDate });
    }

    if (endDate) {
      query.andWhere('user.createdAt <= :endDate', { endDate });
    }

    // Validate sortBy field to prevent SQL injection
    const allowedSortFields = [
      'id',
      'name',
      'email',
      'createdAt',
      'updatedAt',
      'role',
    ];
    const validSortBy = allowedSortFields.includes(sortBy)
      ? sortBy
      : 'createdAt';

    // Apply sorting
    query.orderBy(
      `user.${validSortBy}`,
      sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC',
    );

    // Apply pagination
    query.skip((page - 1) * limit).take(limit);

    // Execute query and get results with count
    const [items, total] = await query.getManyAndCount();

    Logger.log(`Found ${total} users with filter criteria`);

    // Return paginated results with metadata
    return {
      data: items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
  async getUsersByIds(ids: number[]) {
    return await this.usersRepository.findByIds(ids);
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
