import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { ServiceRegistryService } from 'src/services/service-registry.service';

// Middleware responsible for routing requests to appropriate microservices
// Handles request forwarding, header management, and path rewriting
@Injectable()
export class ProxyMiddleware implements NestMiddleware {
  constructor(private serviceRegistry: ServiceRegistryService) {}

  use(req: Request, res: Response, next: NextFunction) {
    // Extract service name from URL path (e.g., /auth/login -> auth)
    const pathParts = req.originalUrl.split('/');
    const service = pathParts[1];

    // Continue if no service is specified in the path
    if (!service) {
      return next();
    }

    // Get the target service URL from registry
    const targetUrl = this.serviceRegistry.getServiceUrl(service);

    // Handle request proxying if service exists
    if (targetUrl) {
      // Remove service name from path and ensure valid format
      const rewrittenPath =
        req.originalUrl.replace(new RegExp(`^/${service}`), '') || '/';
      const destinationUrl = `${targetUrl}${rewrittenPath}`;

      // Log proxy destination for debugging
      console.log(
        `Redirecting request: ${req.originalUrl} -> ${destinationUrl}`,
      );

      // Configure proxy middleware with request handling
      const proxy = createProxyMiddleware({
        target: targetUrl,
        on: {
          // Configure request interceptor for header and body management
          proxyReq: (proxyReq, req: Request) => {
            // Preserve authorization headers if present
            if (req.headers.authorization) {
              proxyReq.setHeader('Authorization', req.headers.authorization);
            }

            // Handle POST/PUT request body forwarding
            if (req.body && Object.keys(req.body).length) {
              const bodyData = JSON.stringify(req.body);
              proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
              proxyReq.setHeader('Content-Type', 'application/json');
              proxyReq.write(bodyData);
            }
          },
        },
        // Configure dynamic routing based on destination URL
        router: async (req) => {
          return destinationUrl;
        },
      });

      // Execute proxy middleware
      return proxy(req, res, next);
    }

    // Log unmatched service requests and continue
    console.log('No matching service for:', req.originalUrl);
    next();
  }
}
