import { Injectable, Inject, OnModuleInit, Logger, UnauthorizedException } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { UserService } from '../user/user.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly userService: UserService,
    @Inject('KAFKA_SERVICE') private readonly kafkaClient: ClientKafka,
  ) {}

  async onModuleInit() {
    this.logger.log('Registering as consumer for Kafka topics');

    // Make sure we're subscribed to these topics
    const requiredTopics = [
      'user.authentication.validate',
      'user.authentication.create',
    ];

    requiredTopics.forEach((topic) => {
      this.logger.debug(`Subscribing to topic: ${topic}`);
      this.kafkaClient.subscribeToResponseOf(topic);
    });

    try {
      await this.kafkaClient.connect();
      this.logger.log('Successfully connected to Kafka');
    } catch (error) {
      this.logger.error(
        `Failed to connect to Kafka: ${error.message}`,
        error.stack,
      );
    }
  }

  async validateUser(email: string, password: string): Promise<any> {
    this.logger.debug(`Validating user: ${email}`);
    try {
      const user = await this.userService.findByEmail(email);
      
      if (!user) {
        this.logger.debug(`User not found: ${email}`);
        return { valid: false };
      }

      const passwordValid = await this.verifyPassword(password, user.password);
      
      if (!passwordValid) {
        this.logger.debug(`Invalid password for user: ${email}`);
        return { valid: false };
      }

      this.logger.debug(`Authentication successful for: ${email}`);
      return {
        valid: true,
        userId: user.id,
        email: user.email,
        role: user.role,
      };
    } catch (error) {
      this.logger.error(`Error validating user: ${error.message}`, error.stack);
      return { valid: false, error: error.message };
    }
  }

  private async verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  async createUser(userData: any) {
    const { email, password } = userData;
    
    // Check if user exists
    const existingUser = await this.userService.findByEmail(email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create new user
    const newUser = await this.userService.create({
      email,
      password: hashedPassword,
      name:""
    //   role: userData.role || 'user',
    });
    
    return newUser;
  }

  // Method to publish user events
  async publishUserEvent(topic: string, data: any) {
    return this.kafkaClient.emit(topic, {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }
  
}
