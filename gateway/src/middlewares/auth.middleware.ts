import { HttpService } from '@nestjs/axios';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ServiceRegistryService } from 'src/services/service-registry.service';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  private publicPaths = [
    { path: '/product', method: 'GET' },
    { path: '/product/:id', method: 'GET' },
    { path: '/auth/login', method: 'POST' },
    { path: '/auth/register', method: 'POST' },
    { path: '/health', method: 'POST' },
    { path: '/auth/forgot-password', method: 'POST' },
    { path: '/auth/reset-password', method: 'POST' },
    { path: '/auth/refresh-token', method: 'POST' },
    // etc.
  ];
  // [
  //     '/auth/login',
  //     '/auth/register',
  //     '/health',
  //     '/auth/forgot-password',
  //     '/auth/reset-password',
  //     '/auth/refresh-token',
  //   ];

  constructor(
    private httpService: HttpService,
    private serviceRegistry: ServiceRegistryService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Skip authentication for public routes
    if (this.isPublicPath(req)) {
      return next();
    }

    // Get token from Authorization header or cookies
    const token = this.extractToken(req);
    console.log('toekn', token);
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
      console.log(response);
      // Add user data as headers for microservices
      req.headers['x-user-id'] = response.data.user.userId.toString();
      req.headers['x-user-role'] = response.data.user.role || 'user';

      next();
    } catch (error) {
      console.error('Auth validation error:', error.message);
      return res.status(401).json({ message: 'Unauthorized - Invalid token' });
    }
  }
  private isPublicPath(req: Request): boolean {
    return this.publicPaths.some(
      (route) =>
        req.method === route.method &&
        (req.baseUrl === route.path || req.baseUrl.startsWith(route.path)),
    );
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
