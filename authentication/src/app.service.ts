import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TokenPayload } from './interfaces/token-payload.interface';
import { KafkaService } from './kafka/kafka.service';
import { PasswordService } from './passwordReset/reset-password.service';
import { RefreshTokenService } from './refreshToken/refresh-token.service';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly kafkaService: KafkaService,
    private readonly passwordService: PasswordService,
    private readonly refreshTokenService: RefreshTokenService,
  ) {}

  async login(
    credentials: { email: string; password: string },
    response: Response,
  ) {
    try {
      // Validate credentials via User microservice
      const userResponse = await this.kafkaService.validateCredentials(
        credentials.email,
        credentials.password,
      );

      if (!userResponse || !userResponse.valid) {
        throw new UnauthorizedException('Invalid credentials');
      }

      // Create JWT with minimal info
      const tokenPayload: TokenPayload = {
        userId: userResponse.userId,
        role: userResponse.role || 'user',
        type: 'access', // Set a specific token type
      };
      // Create refresh token with longer expiration
      const refreshTokenPayload: TokenPayload = {
        userId: userResponse.userId,
        role: userResponse.role || 'user',
        type: 'refresh',
      };

      // Set expiration for JWT access
      const expires = new Date();
      expires.setSeconds(
        expires.getSeconds() + this.configService.get('JWT_EXPIRATION'),
      );

      // Set refresh token expiration (longer than access token) Default 7 days
      const refreshExpiration = this.configService.get<number>(
        'JWT_REFRESH_EXPIRATION',
        604800,
      );
      const refreshExpires = new Date();
      refreshExpires.setSeconds(
        refreshExpires.getSeconds() + refreshExpiration,
      );
      // Access token creation
      const accessToken = this.jwtService.sign(tokenPayload);
      // Refresh token creation
      const refreshToken = this.jwtService.sign(refreshTokenPayload, {
        expiresIn:
          this.configService.get('JWT_REFRESH_EXPIRATION', 604800) + 's', // Default 7 days
      });
      // Store refresh token in database
      await this.refreshTokenService.saveRefreshToken(
        userResponse.userId,
        refreshToken,
        refreshExpiration,
      );
      // Set access token in cookie
      response.cookie('Authentication', accessToken, {
        httpOnly: true,
        expires,
        sameSite: 'lax',
      });

      // Set refresh token in cookie
      response.cookie('RefreshToken', refreshToken, {
        httpOnly: true,
        expires: refreshExpires,
        sameSite: 'lax',
      });

      // Emit login event
      await this.kafkaService.emitUserLoggedIn(userResponse.userId);

      return {
        user: {
          userId: userResponse.userId,
          role: userResponse.role,
          email: userResponse.email,
          name: userResponse.name,
        },
      };
    } catch (error) {
      throw new UnauthorizedException('Authentication failed');
    }
  }

  async register(
    userData: {
      email: string;
      password: string;
      [key: string]: any;
    },
    response: Response,
  ) {
    try {
      // Delegate user creation to User microservice
      const { email, password, name } = userData;

      const userResponse = await this.kafkaService.createCredentials(
        email,
        password,
        name,
      );

      if (!userResponse || !userResponse.success) {
        throw new Error(userResponse?.message || 'Registration failed');
      }
      console.log('user role on register is ', userResponse);

      // Create JWT with minimal info
      const tokenPayload: TokenPayload = {
        userId: userResponse.user.id,
        role: userResponse.role || 'user',
        type: 'access', // Set a specific token type
      };
      // Create refresh token with longer expiration
      const refreshTokenPayload: TokenPayload = {
        userId: userResponse.user.id,
        role: userResponse.role || 'user',
        type: 'refresh',
      };

      // Set expiration for JWT access
      const expires = new Date();
      expires.setSeconds(
        expires.getSeconds() + this.configService.get('JWT_EXPIRATION'),
      );

      // Set refresh token expiration (longer than access token) Default 7 days
      const refreshExpiration = this.configService.get<number>(
        'JWT_REFRESH_EXPIRATION',
        604800,
      );
      const refreshExpires = new Date();
      refreshExpires.setSeconds(
        refreshExpires.getSeconds() + refreshExpiration,
      );
      // Access token creation
      const accessToken = this.jwtService.sign(tokenPayload);
      // Refresh token creation
      const refreshToken = this.jwtService.sign(refreshTokenPayload, {
        expiresIn:
          this.configService.get('JWT_REFRESH_EXPIRATION', 604800) + 's', // Default 7 days
      });
      // Store refresh token in database
      await this.refreshTokenService.saveRefreshToken(
        userResponse.user.id,
        refreshToken,
        refreshExpiration,
      );
      // Set access token in cookie
      response.cookie('Authentication', accessToken, {
        httpOnly: true,
        expires,
        sameSite: 'lax',
      });

      // Set refresh token in cookie
      response.cookie('RefreshToken', refreshToken, {
        httpOnly: true,
        expires: refreshExpires,
        sameSite: 'lax',
      });
      return {
        success: true,
        message: 'Registration successful',
        // userId: result.userId,
        user: {
          userId: userResponse.user.id,
          role: userResponse.user.role,
          email: userResponse.user.email,
          name: userResponse.user.name,
        },
      };
    } catch (error) {
      throw new UnauthorizedException(error.message || 'Registration failed');
    }
  }

  async validateToken(token: string) {
    try {
      // Just verify JWT signature and expiration
      const payload = this.jwtService.verify(token);

      // Return minimal identity info from token
      return {
        userId: payload.userId,
        role: payload.role,
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  async requestPasswordReset(email: string) {
    this.logger.debug(`Processing password reset request for ${email}`);

    try {
      const resetResponse = await this.kafkaService.requestPasswordReset(email);
      // Step 2: Store token in password reset entity (using Password Service)
      // This is assuming your PasswordService has a storeResetToken method
      await this.passwordService.storeResetToken(
        resetResponse.userId,
        resetResponse.token,
      );

      // Step 3: Send email with reset link via notification microservice
      const emailResult = await this.kafkaService.sendPasswordResetEmail(
        email,
        resetResponse.token,
      );

      if (!resetResponse.success) {
        this.logger.warn(
          `Password reset failed for ${email}: ${resetResponse.error}`,
        );
        return {
          success: false,
          message: resetResponse.error || 'Unable to process reset request',
        };
      }

      return {
        success: true,
        message:
          'If your email exists in our system, you will receive password reset instructions.',
      };
    } catch (error) {
      this.logger.error(
        `Error in password reset: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        message: 'Service unavailable, please try again later',
      };
    }
  }
}
