import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TokenPayload } from './interfaces/token-payload.interface';
import { KafkaService } from './kafka/kafka.service';

@Injectable()
export class AppService {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly kafkaService: KafkaService,
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
      };

      const expires = new Date();
      expires.setSeconds(
        expires.getSeconds() + this.configService.get('JWT_EXPIRATION'),
      );

      const token = this.jwtService.sign(tokenPayload);

      // Set cookie
      response.cookie('Authentication', token, {
        httpOnly: true,
        expires,
      });

      // Emit login event
      await this.kafkaService.emitUserLoggedIn(userResponse.userId);

      return {
        userId: userResponse.userId,
        token,
      };
    } catch (error) {
      throw new UnauthorizedException('Authentication failed');
    }
  }

  async register(userData: {
    email: string;
    password: string;
    [key: string]: any;
  }) {
    try {
      // Delegate user creation to User microservice
      const { email, password, ...additionalData } = userData;

      const result = await this.kafkaService.createCredentials(
        email,
        password,
        additionalData,
      );

      if (!result || !result.success) {
        throw new Error(result?.message || 'Registration failed');
      }

      return {
        success: true,
        message: 'Registration successful',
        userId: result.userId,
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
}
