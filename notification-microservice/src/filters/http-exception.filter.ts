import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const errorResponse = exception.getResponse();

    // logging errors
    this.logger.error(
      `${request.method} ${request.url} - ${status}: ${
        typeof errorResponse === 'object' && 'message' in errorResponse
          ? errorResponse.message
          : exception.message
      }`,
    );

    // Consistent error response format
    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message:
        typeof errorResponse === 'object' && 'message' in errorResponse
          ? errorResponse.message
          : exception.message,
    });
  }
}
