import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { EmailService } from './email.service';

@Controller()
export class EmailController {
  private readonly logger = new Logger(EmailController.name);

  constructor(private readonly emailService: EmailService) {}
  @MessagePattern('notification.email.passwordReset')
  async sendPasswordResetEmail(
    @Payload() data: { email: string; token: string; resetUrl: string },
  ) {
    this.logger.log(`Received password reset email request for ${data.email}`);

    try {
      const sent = await this.emailService.sendPasswordResetEmail(
        data.email,
        data.token,
        data.resetUrl,
      );

      return { sent, error: sent ? null : 'Failed to send email' };
    } catch (error) {
      this.logger.error(
        `Error sending password reset email: ${error.message}`,
        error.stack,
      );
      return { sent: false, error: 'Failed to send email' };
    }
  }
}
