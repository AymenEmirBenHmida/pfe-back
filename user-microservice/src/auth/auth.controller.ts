import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import * as crypto from 'crypto';
import { AuthService } from './auth.service';
import { UserService } from 'src/user/user.service';

/**
 * Controller handling authentication requests via Kafka message patterns
 * Manages user authentication, password management, and account operations
 */
@Controller()
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
  ) {}
  @MessagePattern('user.getUsersByIds')
  async getUsersByIds(@Payload() data: { ids: number[] }) {
    this.logger.debug('entered message pattern to get users by uds');
    return this.authService.getUsersByIds(data.ids);
  }
  /**
   * Validates user login credentials
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
   * Creates new user account with provided credentials
   */
  @MessagePattern('user.authentication.create')
  async createUser(
    @Payload()
    data: {
      email: string;
      password: string;
      name: string;
      timestamp: string;
    },
  ) {
    this.logger.log(`Received request to create user: ${data.email}`);
    try {
      const result = await this.authService.createUser(data);
      this.logger.log(`User created successfully: ${data.email}`);
      return { success: true, user: result };
    } catch (error) {
      this.logger.error(`Error creating user: ${error.message}`, error.stack);
      return { success: false, error: error.message };
    }
  }

  /**
   * Retrieves user ID by email address
   * Used for account recovery and user lookup operations
   */
  @MessagePattern('user.info.getId')
  async getUserIdByEmail(@Payload() data: { email: string }) {
    try {
      const user = await this.userService.findByEmail(data.email);
      return user ? { exists: true, userId: user.id } : { exists: false };
    } catch (error) {
      this.logger.error(`Failed to get user ID: ${error.message}`);
      return { exists: false, error: 'Failed to retrieve user information' };
    }
  }
  @MessagePattern('user.info.getById')
  async getUserById(@Payload() data: { id: string }) {
    try {
      const user = await this.userService.findOne(+data.id);
      if (!user) return null;

      const { password, ...userInfo } = user;
      return userInfo;
    } catch (error) {
      this.logger.error(`Failed to get user ID: ${error.message}`);
      return { exists: false, error: 'Failed to retrieve user information' };
    }
  }

  /**
   * Updates user password by user ID
   */
  @MessagePattern('user.password.updateById')
  async updatePasswordById(
    @Payload() data: { userId: string; password: string },
  ) {
    try {
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

  /**
   * Handles password reset email notifications
   * This is a placeholder for actual email sending implementation
   */
  @MessagePattern('notification.email.passwordReset')
  async sendPasswordResetEmail(
    @Payload() data: { email: string; token: string; resetUrl: string },
  ) {
    try {
      this.logger.log(
        `Would send password reset email to ${data.email} with reset URL: ${data.resetUrl}`,
      );
      return { sent: true };
    } catch (error) {
      this.logger.error(`Failed to send email: ${error.message}`);
      return { sent: false, error: 'Failed to send email' };
    }
  }

  /**
   * Initiates password reset process
   * Generates secure reset token and returns necessary data
   */
  @MessagePattern('user.authentication.requestReset')
  async requestPasswordReset(@Payload() data: { email: string }) {
    this.logger.log(`Received password reset request for: ${data.email}`);
    try {
      const user = await this.userService.findByEmail(data.email);
      if (!user) {
        this.logger.debug(`User not found for password reset: ${data.email}`);
        // Security: Don't reveal if email exists or not
        return { success: false, error: 'User not found' };
      }

      const token = crypto.randomBytes(32).toString('hex');
      return {
        success: true,
        token,
        email: data.email,
        userId: user.id,
      };
    } catch (error) {
      this.logger.error(
        `Failed to create password reset token: ${error.message}`,
        error.stack,
      );
      return { success: false, error: 'Failed to process reset request' };
    }
  }

  /**
   * Completes password reset using provided token
   * Updates user password after token validation
   */
  @MessagePattern('user.authentication.resetPassword')
  async resetPasswordWithToken(
    @Payload() data: { token: string; newPassword: string; userId: string },
  ) {
    this.logger.log(
      `Processing password reset with token for user ID: ${data.userId}`,
    );
    try {
      const updateResult = await this.userService.updatePassword(
        data.userId,
        data.newPassword,
      );

      if (!updateResult.success) {
        return { success: false, error: updateResult.error };
      }

      return { success: true };
    } catch (error) {
      this.logger.error(
        `Failed to reset password: ${error.message}`,
        error.stack,
      );
      return { success: false, error: 'Failed to reset password' };
    }
  }
}
