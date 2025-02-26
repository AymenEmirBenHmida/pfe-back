import { ServiceRegistry } from '../interfaces/service.interface';

export const servicesConfig: ServiceRegistry = {
  auth: {
    name: 'Authentication Service',
    url: process.env.AUTH_SERVICE_URL || 'http://localhost',
    port: parseInt(process.env.AUTH_SERVICE_PORT || '3001'),
    healthCheck: '/health',
  },
  products: {
    name: 'Product Service',
    url: process.env.PRODUCT_SERVICE_URL || 'http://localhost',
    port: parseInt(process.env.PRODUCT_SERVICE_PORT || '3002'),
    healthCheck: '/health',
  },
  orders: {
    name: 'Order Service',
    url: process.env.ORDER_SERVICE_URL || 'http://localhost',
    port: parseInt(process.env.ORDER_SERVICE_PORT || '3003'),
    healthCheck: '/health',
  },
};
