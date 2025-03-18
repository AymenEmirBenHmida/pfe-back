import {
  Injectable,
  Inject,
  OnModuleInit,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { UserService } from '../user/user.service';
import * as bcrypt from 'bcryptjs';

/**
 * Service handling authentication operations and Kafka communication
 * Manages user validation, creation, and related auth operations
 */
@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly userService: UserService,
    @Inject('KAFKA_SERVICE') private readonly kafkaClient: ClientKafka,
  ) {}

  /**
   * Initializes Kafka connections and topic subscriptions
   * Called when the module is initialized
   */
  async onModuleInit() {
    this.logger.log('Registering as consumer for Kafka topics');

    // Make sure we're subscribed to these topics
    const requiredTopics = [
      'user.authentication.validate',
      'user.authentication.create',
      'user.authentication.requestReset',
      'user.authentication.resetPassword',
      'user.info.getId',
      'user.password.updateById',
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

  /**
   * Validates user credentials against stored data
   * @returns Object with validation result and user data if valid
   */
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

      // Might have to edit this weather the name is always present andw hen to add the company name
      return {
        valid: true,
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      };
    } catch (error) {
      this.logger.error(`Error validating user: ${error.message}`, error.stack);
      return { valid: false, error: error.message };
    }
  }

  /**
   * Verifies if plain password matches hashed password
   * @returns Boolean indicating if passwords match
   */
  private async verifyPassword(
    plainPassword: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  /**
   * Creates a new user with encrypted password
   * @throws Error if user already exists
   * @returns Newly created user object
   */
  async createUser(userData: any) {
    const { email, password } = userData;

    // Check if user exists
    const existingUser = await this.userService.findByEmail(email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Create new user
    const newUser = await this.userService.create({
      email,
      password: password,
      name: '',
      //   role: userData.role || 'user',
    });

    return newUser;
  }

  /**
   * Publishes events to Kafka topics
   * Adds timestamp to event data for tracking
   */
  async publishUserEvent(topic: string, data: any) {
    return this.kafkaClient.emit(topic, {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }
}
