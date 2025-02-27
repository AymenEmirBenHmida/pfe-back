import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AuthService } from './auth.service';

/**
 * Authentication Controller
 * Handles authentication-related message patterns for user validation and creation
 * Integrates with Kafka messaging system for distributed communication
 */
@Controller()
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  /**
   * Validates user credentials through Kafka message pattern
   * @param data Object containing user credentials
   * @param data.email User's email address to validate
   * @param data.password User's password to verify
   * @returns Object containing validation result {valid: boolean, error?: string}
   * @throws Will log and handle any authentication errors
   */
  @MessagePattern('user.authentication.validate')
  async validateCredentials(
    @Payload() data: { email: string; password: string },
  ) {
    this.logger.log(`Received validation request for user: ${data.email}`);
    try {
      const result = await this.authService.validateUser(
        data.email,
        data.password,
      );
      this.logger.log(
        `Validation result for ${data.email}: ${result.valid ? 'success' : 'failed'}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Error validating credentials: ${error.message}`,
        error.stack,
      );
      return { valid: false, error: 'Authentication failed' };
    }
  }

  /**
   * Creates a new user account through Kafka message pattern
   * @param data User creation payload
   * @param data.email User's email address for the new account
   * @param data.password User's password for the new account
   * @param data.additionalData Optional additional user metadata
   * @returns Object containing creation result {success: boolean, userId?: string, error?: string}
   * @throws Will log and handle any user creation errors
   */
  @MessagePattern('user.authentication.create')
  async createUser(
    @Payload() data: { email: string; password: string; additionalData?: any },
  ) {
    this.logger.log(`Received request to create user: ${data.email}`);
    try {
      const result = await this.authService.createUser(data);
      this.logger.log(`User created successfully: ${data.email}`);
      return { success: true, userId: result.id };
    } catch (error) {
      this.logger.error(`Error creating user: ${error.message}`, error.stack);
      return { success: false, error: error.message };
    }
  }
}
