import { HttpService } from '@nestjs/axios';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ServiceRegistryService } from 'src/services/service-registry.service';
import { firstValueFrom } from 'rxjs';
import * as fs from 'fs';
import * as path from 'path';

interface RouteAccess {
  [path: string]: {
    [method: string]: string[];
  };
}

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  private routeAccess: RouteAccess;
  private publicPaths = [
    { path: '/product', method: 'GET' },
    { path: '/product/:id', method: 'GET' },
    { path: '/auth/login', method: 'POST' },
    { path: '/auth/register', method: 'POST' },
    { path: '/health', method: 'POST' },
    { path: '/auth/forgot-password', method: 'POST' },
    { path: '/auth/reset-password', method: 'POST' },
    { path: '/auth/refresh-token', method: 'POST' },
    { path: '/*/uploads/*', method: 'GET' }, // Wildcard pattern for all microservices uploads
  ];

  // Define file access paths that should be public
  private fileAccessPaths = [
    { prefix: '/products/uploads/', method: 'GET' },
    { prefix: '/orders/uploads/', method: 'GET' },
    { prefix: '/users/uploads/', method: 'GET' },
    { prefix: '/categories/uploads/', method: 'GET' },
  ];

  constructor(
    private httpService: HttpService,
    private serviceRegistry: ServiceRegistryService,
  ) {
    // Load route access configuration from JSON file
    try {
      const filePath = path.join(process.cwd(), 'routesAccess.json');
      const fileContent = fs.readFileSync(filePath, 'utf8');
      this.routeAccess = JSON.parse(fileContent);
      console.log('Route access configuration loaded');
    } catch (error) {
      console.error('Failed to load route access configuration:', error);
      this.routeAccess = {};
    }
  }

  async use(req: Request, res: Response, next: NextFunction) {
    const method = req.method;
    const originalPath = req.originalUrl;

    console.log(`Processing request: ${method} ${originalPath}`);

    // Check if it's a file access path
    if (this.isFileAccessPath(originalPath, method)) {
      console.log(`${originalPath} is a file access path, allowing access`);
      return next();
    }

    // Check if it's a public path from the original configuration
    if (this.isPublicPath(req)) {
      console.log(`${originalPath} is in public paths list, allowing access`);
      return next();
    }

    // If not public, token is required
    const token = this.extractToken(req);
    if (!token) {
      console.log('No token provided for protected route');
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

      const userId = response.data.user.userId.toString();
      const userRole = response.data.user.role || 'BUYER';

      console.log(`Authenticated user ID: ${userId}, role: ${userRole}`);

      // Add user data as headers for microservices
      req.headers['x-user-id'] = userId;
      req.headers['x-user-role'] = userRole;
      console.log(this.getPathWithoutFirstSegment(originalPath));
      // Check role-based access in the JSON configuration
      if (
        !this.hasRoleAccess(
          this.getPathWithoutFirstSegment(originalPath),
          method,
          userRole,
        )
      ) {
        console.log(
          `Role ${userRole} does not have access to ${method} ${originalPath}`,
        );
        return res.status(403).json({
          message:
            'Forbidden - You do not have permission to access this resource',
        });
      }

      // User has proper role access, continue
      console.log(
        `Access granted for ${method} ${originalPath} to role ${userRole}`,
      );
      next();
    } catch (error) {
      console.error('Auth validation error:', error.message);
      return res.status(401).json({ message: 'Unauthorized - Invalid token' });
    }
  }

  private isFileAccessPath(path: string, method: string): boolean {
    // Check if the path starts with any of the file access prefixes
    return this.fileAccessPaths.some(
      (filePath) =>
        method === filePath.method && path.startsWith(filePath.prefix),
    );
  }

  private isPublicPath(req: Request): boolean {
    return this.publicPaths.some(
      (route) =>
        req.method === route.method &&
        (req.originalUrl === route.path ||
          this.matchPathPattern(req.path, route.path)),
    );
  }

  private matchPathPattern(requestPath: string, patternPath: string): boolean {
    // Handle path patterns with wildcards (*)
    if (patternPath.includes('*')) {
      const regexPattern = patternPath
        .replace(/\//g, '\\/') // Escape slashes
        .replace(/\*/g, '.*'); // Replace * with .*

      const regex = new RegExp(`^${regexPattern}$`);
      return regex.test(requestPath);
    }

    // Handle path patterns with :param (like /product/:id)
    if (!patternPath.includes(':')) {
      return false;
    }

    const requestSegments = requestPath.split('/').filter(Boolean);
    const patternSegments = patternPath.split('/').filter(Boolean);

    if (requestSegments.length !== patternSegments.length) {
      return false;
    }

    for (let i = 0; i < patternSegments.length; i++) {
      if (patternSegments[i].startsWith(':')) {
        continue; // Parameter matches anything
      }
      if (patternSegments[i] !== requestSegments[i]) {
        return false;
      }
    }

    return true;
  }

  private hasRoleAccess(
    requestPath: string,
    method: string,
    role: string,
  ): boolean {
    // First try direct match
    let config = this.findRouteConfig(requestPath, method);

    // If no direct match, try to match with path parameters
    if (!config) {
      const normalizedPath = this.findMatchingRoute(requestPath);
      if (normalizedPath) {
        config = this.routeAccess[normalizedPath]?.[method];
      }
    }

    // If no config found, deny access
    if (!config) {
      console.log(`No route configuration found for ${method} ${requestPath}`);
      return false;
    }

    // Check if role is allowed
    const hasAccess = config.includes(role) || config.includes('PUBLIC');
    console.log(
      `Role ${role} access to ${method} ${requestPath}: ${hasAccess ? 'allowed' : 'denied'}`,
    );
    return hasAccess;
  }

  private findRouteConfig(path: string, method: string): string[] | null {
    return this.routeAccess[path]?.[method] || null;
  }

  private findMatchingRoute(requestPath: string): string | null {
    const requestSegments = requestPath.split('/').filter(Boolean);

    for (const routePath in this.routeAccess) {
      // Skip if not a parameterized route
      if (!routePath.includes('{') && !routePath.includes(':')) {
        continue;
      }

      const routeSegments = routePath.split('/').filter(Boolean);

      // Different segment count can't be a match
      if (routeSegments.length !== requestSegments.length) {
        continue;
      }

      let isMatch = true;
      for (let i = 0; i < routeSegments.length; i++) {
        const routeSeg = routeSegments[i];

        // Handle both formats: {id} and :id
        if (
          (routeSeg.startsWith('{') && routeSeg.endsWith('}')) ||
          routeSeg.startsWith(':')
        ) {
          continue; // Parameter matches anything
        }

        if (routeSeg !== requestSegments[i]) {
          isMatch = false;
          break;
        }
      }

      if (isMatch) {
        return routePath;
      }
    }

    return null;
  }

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

  private getPathWithoutFirstSegment(path: string): string {
    const cleanPath = path.split('?')[0]; // Remove query params
    const segments = cleanPath.split('/').filter(Boolean);
    segments.shift(); // remove the first segment
    return '/' + segments.join('/');
  }
}
