import {
  Controller,
  Post,
  Body,
  Res,
  Req,
  UnauthorizedException,
  Logger,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { AppService } from './app.service';
import {
  ForgotPasswordDto,
  ResetPasswordDto,
  ResetPasswordEligibilityDto,
} from './dto/password-reset.dto';
import { PasswordService } from './passwordReset/reset-password.service';
import { RefreshTokenService } from './refreshToken/refresh-token.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
@ApiTags('Authentication')
@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(
    private readonly authenticationService: AppService,
    private readonly passwordService: PasswordService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login a user' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', example: 'user@example.com' },
        password: { type: 'string', example: '12345678' },
      },
    },
  })
  async login(
    @Body() credentials: { email: string; password: string },
    @Res({ passthrough: true }) response: Response,
  ) {
    this.logger.log(`Login attempt for user: ${credentials.email}`);
    try {
      const result = await this.authenticationService.login(
        credentials,
        response,
      );
      this.logger.log(`Login successful for user: ${credentials.email}`);
      return result;
    } catch (error) {
      this.logger.error(
        `Login failed for user: ${credentials.email}`,
        error.stack,
      );
      throw error;
    }
  }
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log out the current user' })
  @ApiResponse({ status: 200, description: 'Successfully logged out' })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.logger.log('Logout request received');

    // Get the refresh token from cookie
    const refreshToken = request.cookies['RefreshToken'];

    // Clear cookies regardless of token validity
    response.clearCookie('Authentication');
    response.clearCookie('RefreshToken', { path: '/refresh-token' }); // Must match path setting

    // Revoke the refresh token if present
    if (refreshToken) {
      try {
        await this.refreshTokenService.revokeToken(refreshToken);
      } catch (error) {
        this.logger.error('Error revoking token', error.stack);
      }
    }

    return { success: true, message: 'Logged out successfully' };
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', example: 'newuser@example.com' },
        password: { type: 'string', example: 'StrongP@ssword1' },
        name: { type: 'string', example: 'John Doe' },
      },
    },
  })
  async register(
    @Body() userData: any,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.logger.log(`Registration attempt for user: ${userData.email}`);
    try {
      const result = await this.authenticationService.register(
        userData,
        response,
      );
      this.logger.log(`Registration successful for user: ${userData.email}`);
      return result;
    } catch (error) {
      this.logger.error(
        `Registration failed for user: ${userData.email}`,
        error.stack,
      );
      throw error;
    }
  }

  @Post('validate-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate an access token' })
  @ApiResponse({ status: 200, description: 'Token is valid' })
  async validateToken(@Req() request: Request) {
    this.logger.log('Token validation request received');
    const token = request.headers.authorization?.split(' ')[1];
    console.log('token ', token);
    if (!token) {
      this.logger.warn('Token validation failed: No token provided');
      throw new UnauthorizedException('No token provided');
    }

    try {
      const user = await this.authenticationService.validateToken(token);
      this.logger.log(`Token validated successfully for user: ${user}`);
      return { valid: true, user };
    } catch (error) {
      this.logger.error('Token validation failed', error.stack);
      throw error;
    }
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a password reset link' })
  @ApiBody({
    type: ForgotPasswordDto,
    examples: {
      example1: {
        value: { email: 'user@example.com' },
      },
    },
  })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    this.logger.log(
      `Password reset request received for: ${forgotPasswordDto.email}`,
    );
    return this.passwordService.requestPasswordReset(forgotPasswordDto.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with token' })
  @ApiBody({
    type: ResetPasswordDto,
    examples: {
      example1: {
        value: { token: 'abcdefg123', password: 'NewP@ssword123' },
      },
    },
  })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    this.logger.log('Password reset execution request received');
    return this.passwordService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.password,
    );
  }
  @Post('reset-password-eligibility')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify reset password eligibility' })
  @ApiBody({
    type: ResetPasswordDto,
    examples: {
      example1: {
        value: { token: 'abcdefg123' },
      },
    },
  })
  async resetPasswordEligibility(
    @Body() resetPasswordEligibilityDto: ResetPasswordEligibilityDto,
  ) {
    this.logger.log('Password reset execution request received');
    return this.passwordService.resetPasswordEligiblity(
      resetPasswordEligibilityDto.token,
    );
  }

  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh authentication tokens' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        refreshToken: { type: 'string', example: 'jwt_refresh_token_here' },
      },
    },
  })
  async refreshToken(
    @Body() body: { refreshToken?: string },
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.logger.log('Token refresh request received');
    console.log('Cookies:', JSON.stringify(request.cookies, null, 2));
    // Get the refresh token from request body or cookie
    const refreshToken =
      body?.refreshToken ||
      request.cookies['refreshToken'] ||
      request.cookies['RefreshToken'];

    if (!refreshToken) {
      this.logger.warn('No refresh token provided');
      throw new BadRequestException('Refresh token is required');
    }

    try {
      // Verify the JWT signature and expiration
      const payload = this.jwtService.verify(refreshToken);

      // Check token type
      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      // Find the token in the database
      const storedToken =
        await this.refreshTokenService.findByToken(refreshToken);

      if (!storedToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      if (new Date() > storedToken.expiresAt) {
        // Revoke the token if it's expired
        await this.refreshTokenService.revokeToken(refreshToken);
        throw new UnauthorizedException('Refresh token expired');
      }

      // Create a new access token
      const accessTokenPayload = {
        userId: payload.userId,
        role: payload.role,
        type: 'access',
      };

      // Set expiration for new access token
      const accessExpiration = this.configService.get('JWT_EXPIRATION');
      const expires = new Date();
      expires.setSeconds(expires.getSeconds() + accessExpiration);

      // Generate new access token
      const newAccessToken = this.jwtService.sign(accessTokenPayload);

      // Set the cookie with the new access token
      response.cookie('Authentication', newAccessToken, {
        httpOnly: true,
        expires,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
      });

      this.logger.log(`Access token refreshed for user: ${payload.userId}`);

      return {
        userId: payload.userId,
        accessToken: newAccessToken,
      };
    } catch (error) {
      this.logger.error(`Token refresh failed: ${error.message}`, error.stack);
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
