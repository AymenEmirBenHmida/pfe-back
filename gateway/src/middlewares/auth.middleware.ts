import { HttpService } from '@nestjs/axios';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

import { ServiceRegistryService } from 'src/services/service-registry.service';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  private publicPaths = [
    '/auth/login',
    '/auth/register',
    '/health',
    '/auth/forgot-password',
    '/auth/reset-password',
  ];

  constructor(
    private httpService: HttpService,
    private serviceRegistry: ServiceRegistryService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Skip authentication for public routes
    if (this.isPublicPath(req.baseUrl)) {
      return next();
    }

    // Get token from Authorization header or cookies
    const token = this.extractToken(req);
    if (!token) {
      return res
        .status(401)
        .json({ message: 'Unauthorized - No token provided' });
    }

    try {
      // Get auth service URL dynamically from registry
      const authServiceUrl = this.serviceRegistry.getServiceUrl('auth');

      if (!authServiceUrl) {
        console.error('Auth service not available in registry');
        return res
          .status(503)
          .json({ message: 'Authentication service unavailable' });
      }

      // Validate token using auth service
      const response = await firstValueFrom(
        this.httpService.post(
          `${authServiceUrl}/validate-token`,
          {},
          { headers: { Authorization: `Bearer ${token}` } },
        ),
      );

      // Attach user data to request for downstream services
      req['user'] = response.data.user;

      // Add user data as headers for microservices
      req.headers['x-user-id'] = response.data.user.userId.toString();
      req.headers['x-user-role'] = response.data.user.role || 'user';

      next();
    } catch (error) {
      console.error('Auth validation error:', error.message);
      return res.status(401).json({ message: 'Unauthorized - Invalid token' });
    }
  }
  //Test if a path is public or not
  private isPublicPath(path: string): boolean {
    return this.publicPaths.some((publicPath) => path.startsWith(publicPath));
  }
  //Extract token from request
  private extractToken(req: Request): string | null {
    // Try to get from Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Otherwise try to get from cookies
    const cookieToken = req.cookies?.Authentication;
    if (cookieToken) {
      return cookieToken;
    }

    return null;
  }
}
