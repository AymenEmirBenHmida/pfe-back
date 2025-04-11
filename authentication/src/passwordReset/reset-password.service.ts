import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { KafkaService } from '../kafka/kafka.service';
import { PasswordReset } from './entities/password-reset.entity';

@Injectable()
export class PasswordService {
  private readonly logger = new Logger(PasswordService.name);

  constructor(
    @InjectRepository(PasswordReset)
    private resetRepository: Repository<PasswordReset>,
    private kafkaService: KafkaService,
  ) {}

  async requestPasswordReset(
    email: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Check if user exists via Kafka and get userId
      const userInfo = await this.kafkaService.getUserIdByEmail(email);

      if (!userInfo.exists || !userInfo.userId) {
        // Still return success to prevent email enumeration
        return {
          success: true,
          message:
            'If your email exists in our system, you will receive password reset instructions.',
        };
      }

      // Generate secure token
      const token = crypto.randomBytes(32).toString('hex');

      // Set expiration (1 hour)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1);

      // Invalidate any previous tokens for this user
      await this.resetRepository.update(
        { userId: userInfo.userId, used: false },
        { used: true },
      );

      // Save new token with userId (not email)
      const resetToken = this.resetRepository.create({
        token,
        userId: userInfo.userId,
        expiresAt,
      });
      await this.resetRepository.save(resetToken);

      // Send email notification via Kafka, passing email but not storing it
      await this.kafkaService.sendPasswordResetEmail(email, token);

      return {
        success: true,
        message:
          'If your email exists in our system, you will receive password reset instructions.',
      };
    } catch (error) {
      this.logger.error(
        `Error in password reset request: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        message: 'Service temporarily unavailable',
      };
    }
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Find token in DB
      const resetToken = await this.resetRepository.findOne({
        where: {
          token,
          used: false,
        },
      });
      console.log('token', token);

      // Invalid token
      if (!resetToken) {
        return {
          success: false,
          message: 'Invalid reset token',
        };
      }

      // Token expired
      if (new Date() > resetToken.expiresAt) {
        return {
          success: false,
          message: 'Reset token expired',
        };
      }

      // Mark token as used immediately to prevent reuse
      resetToken.used = true;
      await this.resetRepository.save(resetToken);

      // Send reset password request to user microservice
      // Pass the token, new password, and userId
      const result = await this.kafkaService.resetPassword(
        token,
        newPassword,
        resetToken.userId,
      );

      if (!result.success) {
        return {
          success: false,
          message: result.error || 'Failed to update password',
        };
      }

      return {
        success: true,
        message: 'Your password has been successfully reset',
      };
    } catch (error) {
      this.logger.error(
        `Error in password reset: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        message: 'Service temporarily unavailable',
      };
    }
  }
  // Add this method if it doesn't exist
  async storeResetToken(userId: string, token: string) {
    try {
      // Create expiration date (1 hour from now)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1);

      // Create new password reset token
      const resetToken = this.resetRepository.create({
        userId,
        token,
        expiresAt,
        used: false,
      });

      // Save to database
      await this.resetRepository.save(resetToken);

      this.logger.debug(`Reset token stored for user: ${userId}`);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to store reset token: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
