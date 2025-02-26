export interface ServiceConfig {
  url: string;
  port: number;
  name: string;
  healthCheck?: string;
}

export interface ServiceRegistry {
  [key: string]: ServiceConfig;
}