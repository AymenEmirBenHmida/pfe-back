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
}
