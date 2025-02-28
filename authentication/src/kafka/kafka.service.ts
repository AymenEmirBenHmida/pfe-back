import { Injectable, Inject, OnModuleInit, Logger } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { firstValueFrom, timeout, catchError, retry, of } from 'rxjs';

@Injectable()
export class KafkaService implements OnModuleInit {
  private readonly logger = new Logger(KafkaService.name);

  constructor(
    @Inject('KAFKA_SERVICE') private readonly kafkaClient: ClientKafka,
  ) {}

  async onModuleInit() {
    // Topics this service needs responses from
    const topics = [
      'user.authentication.validate',
      'user.authentication.create',
      'user.authentication.requestReset',
      'user.authentication.resetPassword',
    ];
    topics.forEach((topic) => this.kafkaClient.subscribeToResponseOf(topic));
    await this.kafkaClient.connect();
  }

  async validateCredentials(email: string, password: string) {
    this.logger.debug(`Sending credential validation request for ${email}`);
    try {
      const result = await firstValueFrom(
        this.kafkaClient
          .send('user.authentication.validate', { email, password })
          .pipe(
            // Add retry logic - retry 3 times with exponential backoff
            // retry({ count: 3, delay: (_, retryCount) => retryCount * 1000 }),
            timeout(10000), // 10 second timeout (increased from 5)
            catchError((err) => {
              this.logger.error(
                `Kafka validation error: ${err.message}`,
                err.stack,
              );
              return of({ valid: false, error: 'Service unavailable' });
            }),
          ),
      );
      this.logger.debug(
        `Received validation response: ${JSON.stringify(result)}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Error validating credentials: ${error.message}`,
        error.stack,
      );
      return { valid: false, error: 'Service unavailable' };
    }
  }

  async createCredentials(
    email: string,
    password: string,
    additionalData?: any,
  ) {
    this.logger.debug(`Sending credential creation request for ${email}`);
    try {
      const result = await firstValueFrom(
        this.kafkaClient
          .send('user.authentication.create', {
            email,
            password,
            additionalData,
            timestamp: new Date().toISOString(),
          })
          .pipe(
            // Add retry logic - retry 3 times with exponential backoff
            // retry({ count: 3, delay: (_, retryCount) => retryCount * 1000 }),
            timeout(10000), // 10 second timeout (increased from 5)
            catchError((err) => {
              this.logger.error(
                `Kafka creation error: ${err.message}`,
                err.stack,
              );
              return of({ success: false, error: 'Service unavailable' });
            }),
          ),
      );
      this.logger.debug(
        `Received creation response: ${JSON.stringify(result)}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Error creating credentials: ${error.message}`,
        error.stack,
      );
      return { success: false, error: 'Service unavailable' };
    }
  }

  async emitUserLoggedIn(userId: string) {
    return this.kafkaClient.emit('auth.user.logged_in', {
      userId,
      timestamp: new Date().toISOString(),
    });
  }

  async requestPasswordReset(email: string) {
    this.logger.debug(`Sending password reset request for ${email}`);
    try {
      const result = await firstValueFrom(
        this.kafkaClient
          .send('user.authentication.requestReset', {
            email,
            timestamp: new Date().toISOString(),
          })
          .pipe(
            timeout(10000),
            catchError((err) => {
              this.logger.error(
                `Kafka reset request error: ${err.message}`,
                err.stack,
              );
              return of({ success: false, error: 'Service unavailable' });
            }),
          ),
      );
      this.logger.debug(
        `Received reset request response: ${JSON.stringify(result)}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Error requesting password reset: ${error.message}`,
        error.stack,
      );
      return { success: false, error: 'Service unavailable' };
    }
  }

  async resetPassword(token: string, newPassword: string) {
    this.logger.debug(`Sending password reset execution`);
    try {
      const result = await firstValueFrom(
        this.kafkaClient
          .send('user.authentication.resetPassword', {
            token,
            newPassword,
            timestamp: new Date().toISOString(),
          })
          .pipe(
            timeout(10000),
            catchError((err) => {
              this.logger.error(
                `Kafka reset execution error: ${err.message}`,
                err.stack,
              );
              return of({ success: false, error: 'Service unavailable' });
            }),
          ),
      );
      this.logger.debug(
        `Received reset execution response: ${JSON.stringify(result)}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Error executing password reset: ${error.message}`,
        error.stack,
      );
      return { success: false, error: 'Service unavailable' };
    }
  }

  async getUserIdByEmail(email: string) {
    this.logger.debug(`Getting user ID for email: ${email}`);
    try {
      const result = await firstValueFrom(
        this.kafkaClient.send('user.info.getId', { email }).pipe(
          timeout(10000),
          catchError((err) => {
            this.logger.error(`Kafka error: ${err.message}`, err.stack);
            return of({ exists: false, error: 'Service unavailable' });
          }),
        ),
      );
      return result; // Should return {exists: boolean, userId: string}
    } catch (error) {
      this.logger.error(`Error getting user ID: ${error.message}`, error.stack);
      return { exists: false, error: 'Service unavailable' };
    }
  }

  async sendPasswordResetEmail(email: string, token: string) {
    this.logger.debug(`Requesting password reset email for a user`);
    try {
      const result = await firstValueFrom(
        this.kafkaClient
          .send('notification.email.passwordReset', {
            email,
            token,
            resetUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`,
          })
          .pipe(
            timeout(10000),
            catchError((err) => {
              this.logger.error(`Kafka error: ${err.message}`, err.stack);
              return of({ sent: false, error: 'Service unavailable' });
            }),
          ),
      );
      return result;
    } catch (error) {
      this.logger.error(`Error sending email: ${error.message}`, error.stack);
      return { sent: false, error: 'Service unavailable' };
    }
  }

  async updateUserPasswordById(userId: string, newPassword: string) {
    this.logger.debug(`Updating password for user ID: ${userId}`);
    try {
      const result = await firstValueFrom(
        this.kafkaClient
          .send('user.password.updateById', {
            userId,
            password: newPassword,
          })
          .pipe(
            timeout(10000),
            catchError((err) => {
              this.logger.error(`Kafka error: ${err.message}`, err.stack);
              return of({ success: false, error: 'Service unavailable' });
            }),
          ),
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Error updating password: ${error.message}`,
        error.stack,
      );
      return { success: false, error: 'Service unavailable' };
    }
  }
}
