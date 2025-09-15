import { Controller, Get } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  async getDashboardStats() {
    return this.dashboardService.getDashboardStats();
  }

  @Get('yearly-earnings')
  async getYearlyEarnings() {
    return this.dashboardService.getYearlyEarnings();
  }

  @Get('category-traffic')
  async getCategoryTraffic() {
    return this.dashboardService.getCategoryTraffic();
  }

  @Get('full')
  async getFullDashboard() {
    return this.dashboardService.getFullDashboardData();
  }
}
