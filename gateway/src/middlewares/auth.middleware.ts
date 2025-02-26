// gateway/src/middlewares/auth.middleware.ts
import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import axios from 'axios';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  private publicPaths = ['/auth/login', '/auth/register', '/health', '/'];

  constructor() {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Skip authentication for public routes
    if (this.isPublicPath(req.path)) {
      return next();
    }

    // Get token from Authorization header
    const token = this.extractToken(req);
    if (!token) {
      return res
        .status(401)
        .json({ message: 'Unauthorized - No token provided' });
    }

    try {
      // Validate token using auth service
      const response = await axios.post(
        'http://localhost:3001/validate-token',
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );

      // Attach user data to request for downstream services
      req['user'] = response.data.user;

      // Add user data as headers for microservices
      req.headers['x-user-id'] = response.data.user.id.toString();
      req.headers['x-user-role'] = response.data.user.role || 'user';

      next();
    } catch (error) {
      return res.status(401).json({ message: 'Unauthorized - Invalid token' });
    }
  }

  private isPublicPath(path: string): boolean {
    return this.publicPaths.some((publicPath) => path.includes(publicPath));
  }

  private extractToken(req: Request): string | null {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7);
  }
}
