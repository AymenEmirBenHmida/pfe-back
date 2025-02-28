import {
  Controller,
  Post,
  Body,
  Res,
  Req,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { AppService } from './app.service';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password-reset.dto';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(private readonly authenticationService: AppService) {}

  @Post('login')
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

  @Post('register')
  async register(@Body() userData: any) {
    this.logger.log(`Registration attempt for user: ${userData.email}`);
    try {
      const result = await this.authenticationService.register(userData);
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
  async validateToken(@Req() request: Request) {
    this.logger.log('Token validation request received');
    const token = request.headers.authorization?.split(' ')[1];
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
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    this.logger.log(
      `Password reset request received for: ${forgotPasswordDto.email}`,
    );
    return this.authenticationService.requestPasswordReset(
      forgotPasswordDto.email,
    );
  }

  @Post('reset-password')
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    this.logger.log('Password reset execution request received');
    return this.authenticationService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.password,
    );
  }
  
}
