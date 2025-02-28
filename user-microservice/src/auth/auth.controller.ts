import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AuthService } from './auth.service';
import { UserService } from 'src/user/user.service'; // Add this import

/**
 * Authentication Controller
 * Handles authentication-related message patterns for user validation and creation
 * Integrates with Kafka messaging system for distributed communication
 */
@Controller()
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService, // Add this injection
  ) {}

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

  // Add these handlers to your existing Kafka controller

  @MessagePattern('user.info.getId')
  async getUserIdByEmail(@Payload() data: { email: string }) {
    try {
      // Use userService instead of authService
      const user = await this.userService.findByEmail(data.email);

      if (!user) {
        return { exists: false };
      }

      return {
        exists: true,
        userId: user.id,
      };
    } catch (error) {
      this.logger.error(`Failed to get user ID: ${error.message}`);
      return { exists: false, error: 'Failed to retrieve user information' };
    }
  }
  @MessagePattern('user.password.updateById')
  async updatePasswordById(
    @Payload() data: { userId: string; password: string },
  ) {
    try {
      // Use userService instead of authService
      const result = await this.userService.updatePassword(
        data.userId,
        data.password,
      );

      if (!result.success) {
        return { success: false, error: result.error };
      }

      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to update password: ${error.message}`);
      return { success: false, error: 'Failed to update password' };
    }
  }
  // Also implement the notification handler or a separate notification service
  @MessagePattern('notification.email.passwordReset')
  async sendPasswordResetEmail(
    @Payload() data: { email: string; token: string; resetUrl: string },
  ) {
    try {
      // Implement email sending logic here
      // This could use a library like nodemailer or a service like SendGrid

      this.logger.log(
        `Would send password reset email to ${data.email} with reset URL: ${data.resetUrl}`,
      );

      // In development, you might just log this
      return { sent: true };
    } catch (error) {
      this.logger.error(`Failed to send email: ${error.message}`);
      return { sent: false, error: 'Failed to send email' };
    }
  }
}
