import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { servicesConfig } from '../config/services.config';

// Service that manages and provides access to microservice URLs
// Acts as a central registry for all service endpoints
@Injectable()
export class ServiceRegistryService {
  // Maps service names to their corresponding URLs
  private readonly serviceMap: Record<string, string>;

  constructor(private configService: ConfigService) {
    this.serviceMap = this.initializeServiceMap();
  }

  // Initializes the service map from the configuration
  // Creates a map of service names to their full URLs
  private initializeServiceMap(): Record<string, string> {
    return Object.entries(servicesConfig).reduce(
      (acc, [key, config]) => {
        acc[key] = `${config.url}:${config.port}`;
        return acc;
      },
      {} as Record<string, string>,
    );
  }

  // Gets the URL for a specific service by name
  getServiceUrl(serviceName: string): string | undefined {
    console.log(this.serviceMap);
    return this.serviceMap[serviceName];
  }

  // Returns a copy of all service URLs
  getAllServices(): Record<string, string> {
    return { ...this.serviceMap };
  }
}
