import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
     this.transporter = nodemailer.createTransport({
       service: 'gmail', // This automatically sets the correct host and port
       auth: {
         user: this.configService.get<string>('SMTP_USER'),
         pass: this.configService.get<string>('SMTP_PASSWORD'),
       },
       tls: {
         rejectUnauthorized: false, // For development only - don't use in production
       },
     });

     // Verify connection
     this.transporter.verify((error, success) => {
       if (error) {
         this.logger.error(`SMTP connection error: ${error.message}`);
       } else {
         this.logger.log('SMTP server connection established successfully');
       }
     });
  }

  async sendPasswordResetEmail(email: string, token: string, resetUrl: string): Promise<boolean> {
    this.logger.log(`Sending password reset email to ${email}`);
    
    try {
      const info = await this.transporter.sendMail({
        from: `"TekList Support" <${this.configService.get<string>('EMAIL_FROM')}>`,
        to: email,
        subject: 'Password Reset Instructions',
        html: this.getPasswordResetTemplate(resetUrl),
      });

      this.logger.log(`Email sent: ${info.messageId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email: ${error.message}`, error.stack);
      return false;
    }
  }

  private getPasswordResetTemplate(resetUrl: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset</h2>
        <p>You've requested to reset your password. Please click the link below to set a new password:</p>
        <p>
          <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px;">
            Reset Password
          </a>
        </p>
        <p>If you didn't request this change, you can safely ignore this email.</p>
        <p>This link will expire in 1 hour for security reasons.</p>
        <p>Best regards,<br>TekList Team</p>
      </div>
    `;
  }
}