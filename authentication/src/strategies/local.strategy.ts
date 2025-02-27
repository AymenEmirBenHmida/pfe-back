import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { KafkaService } from 'src/kafka/kafka.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly kafkaService: KafkaService) {
    super({ usernameField: 'email' });
  }

  async validate(email: string, password: string) {
    try {
      // Use Kafka to validate credentials with User service
      const userResponse = await this.kafkaService.validateCredentials(
        email,
        password,
      );

      if (!userResponse || !userResponse.valid) {
        throw new UnauthorizedException('Invalid credentials');
      }

      // Return minimal user info
      return {
        userId: userResponse.userId,
        email,
        role: userResponse.role || 'user',
      };
    } catch (error) {
      throw new UnauthorizedException('Authentication failed');
    }
  }
}
