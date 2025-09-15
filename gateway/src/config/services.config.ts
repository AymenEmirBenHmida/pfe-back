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
    port: parseInt(process.env.PRODUCT_SERVICE_PORT || '3005'),
    healthCheck: '/health',
  },
  orders: {
    name: 'Order Service',
    url: process.env.ORDER_SERVICE_URL || 'http://localhost',
    port: parseInt(process.env.ORDER_SERVICE_PORT || '3007'),
    healthCheck: '/health',
  },
  ai: {
    name: 'Ai Service',
    url: process.env.RECOMMENDATION_SERVICE_URL || 'http://localhost',
    port: parseInt(process.env.RECOMMENDATION_SERVICE_PORT || '5001'),
    healthCheck: '/health',
  },
  users: {
    name: 'User Service',
    url: process.env.USER_SERVICE_URL || 'http://localhost',
    port: parseInt(process.env.USER_SERVICE_PORT || '3004'),
    healthCheck: '/health',
  },
  reviews: {
    name: 'Review Service',
    url: process.env.REVIEW_SERVICE_URL || 'http://localhost',
    port: parseInt(process.env.REVIEW_SERVICE_PORT || '3006'),
    healthCheck: '/health',
  },
};
