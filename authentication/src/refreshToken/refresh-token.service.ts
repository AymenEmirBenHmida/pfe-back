import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RefreshToken } from './entities/refresh-token.entity';

@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);

  constructor(
    @InjectRepository(RefreshToken)
    private refreshTokenRepository: Repository<RefreshToken>,
  ) {}

  async saveRefreshToken(
    userId: string,
    token: string,
    expiresIn: number,
  ): Promise<RefreshToken> {
    try {
      // Calculate expiration date
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + expiresIn);

      // Create refresh token entity
      const refreshToken = this.refreshTokenRepository.create({
        userId,
        token,
        expiresAt,
        revoked: false,
      });

      // Save to database
      await this.refreshTokenRepository.save(refreshToken);
      this.logger.debug(`Refresh token saved for user ${userId}`);

      return refreshToken;
    } catch (error) {
      this.logger.error(
        `Failed to save refresh token: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async findByToken(token: string): Promise<RefreshToken | null> {
    return this.refreshTokenRepository.findOne({
      where: { token, revoked: false },
    });
  }

  async revokeToken(
    token: string,
    replacedByToken?: string ,
  ): Promise<boolean> {
    try {
      const refreshToken = await this.findByToken(token);

      if (!refreshToken) {
        return false;
      }

      // Mark token as revoked
      refreshToken.revoked = true;
      refreshToken.revokedAt = new Date();

      // If we're replacing this token with a new one, store reference
      if (replacedByToken) {
        refreshToken.replacedByToken = replacedByToken;
      }

      await this.refreshTokenRepository.save(refreshToken);
      this.logger.debug(
        `Refresh token revoked for user ${refreshToken.userId}`,
      );

      return true;
    } catch (error) {
      this.logger.error(
        `Failed to revoke token: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  async revokeAllUserTokens(userId: string): Promise<boolean> {
    try {
      await this.refreshTokenRepository.update(
        { userId, revoked: false },
        { revoked: true, revokedAt: new Date() },
      );

      this.logger.debug(`All refresh tokens revoked for user ${userId}`);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to revoke user tokens: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  async removeExpiredTokens(): Promise<void> {
    try {
      // Delete expired and revoked tokens older than 7 days
      const dateThreshold = new Date();
      dateThreshold.setDate(dateThreshold.getDate() - 7);

      await this.refreshTokenRepository
        .createQueryBuilder()
        .delete()
        .where(
          '(expiresAt < :now AND revoked = false) OR (revokedAt < :threshold AND revoked = true)',
          {
            now: new Date(),
            threshold: dateThreshold,
          },
        )
        .execute();

      this.logger.debug('Expired refresh tokens cleaned up');
    } catch (error) {
      this.logger.error(
        `Failed to clean up expired tokens: ${error.message}`,
        error.stack,
      );
    }
  }
}
