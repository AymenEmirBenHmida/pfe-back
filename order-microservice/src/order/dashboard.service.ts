import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from './entities/order.entity';
import { ClientKafka } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class DashboardService implements OnModuleInit {
  constructor(
    @InjectRepository(Order)
    private orderRepo: Repository<Order>,
    @Inject('KAFKA_ORDER_CLIENT')
    private readonly kafkaClient: ClientKafka,
  ) {}

  async onModuleInit() {
    const topics = ['user.getUsersByIds', 'product.getProductsByIds'];

    topics.forEach((topic) => this.kafkaClient.subscribeToResponseOf(topic));

    try {
      await this.kafkaClient.connect();
      console.log('Dashboard service connected to Kafka');
    } catch (error) {
      console.error(`Failed to connect to Kafka: ${error.message}`);
    }
  }

  async getDashboardStats() {
    const currentDate = new Date();
    const currentMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1,
    );
    const lastMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() - 1,
      1,
    );
    const lastMonthEnd = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      0,
    );

    // Get current month stats
    const currentMonthOrders = await this.orderRepo
      .createQueryBuilder('order')
      .where('order.createdAt >= :start', { start: currentMonth })
      .andWhere('order.status != :status', { status: 'cancelled' })
      .getMany();

    // Get last month stats
    const lastMonthOrders = await this.orderRepo
      .createQueryBuilder('order')
      .where('order.createdAt >= :start', { start: lastMonth })
      .andWhere('order.createdAt <= :end', { end: lastMonthEnd })
      .andWhere('order.status != :status', { status: 'cancelled' })
      .getMany();

    // Calculate totals
    const currentMonthEarnings = currentMonthOrders.reduce(
      (sum, order) => sum + Number(order.amount),
      0,
    );
    const lastMonthEarnings = lastMonthOrders.reduce(
      (sum, order) => sum + Number(order.amount),
      0,
    );

    // Get unique customers
    const currentMonthCustomers = new Set(
      currentMonthOrders.map((order) => order.userId),
    ).size;
    const lastMonthCustomers = new Set(
      lastMonthOrders.map((order) => order.userId),
    ).size;

    // Calculate percentage changes
    const earningsChange =
      lastMonthEarnings > 0
        ? ((currentMonthEarnings - lastMonthEarnings) / lastMonthEarnings) * 100
        : 0;

    const customersChange =
      lastMonthCustomers > 0
        ? ((currentMonthCustomers - lastMonthCustomers) / lastMonthCustomers) *
          100
        : 0;

    return {
      totalEarnings: currentMonthEarnings,
      totalCustomers: currentMonthCustomers,
      earningsChange: Number(earningsChange.toFixed(2)),
      customersChange: Number(customersChange.toFixed(2)),
    };
  }

  async getYearlyEarnings() {
    const currentDate = new Date();
    const yearStart = new Date(currentDate.getFullYear(), 0, 1);

    const orders = await this.orderRepo
      .createQueryBuilder('order')
      .where('order.createdAt >= :start', { start: yearStart })
      .andWhere('order.status != :status', { status: 'cancelled' })
      .getMany();

    // Group by month
    const monthlyEarnings = Array.from({ length: 12 }, (_, i) => ({
      month: new Date(currentDate.getFullYear(), i).toLocaleString('default', {
        month: 'short',
      }),
      earnings: 0,
    }));

    orders.forEach((order) => {
      const month = order.createdAt.getMonth();
      monthlyEarnings[month].earnings += Number(order.amount);
    });

    return monthlyEarnings;
  }

  async getCategoryTraffic() {
    // Get all orders with items
    const orders = await this.orderRepo
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'item')
      .where('order.status != :status', { status: 'cancelled' })
      .getMany();

    // Get all product IDs
    const productIds = orders.flatMap((order) =>
      order.items.map((item) => item.productId),
    );

    if (productIds.length === 0) {
      return [];
    }

    // Get products with categories via Kafka
    const products = await firstValueFrom(
      this.kafkaClient.send('product.getProductsByIds', {
        ids: [...new Set(productIds)],
      }),
    );
    console.log('products returned :', products);

    // Count category occurrences
    const categoryCount = new Map<string, number>();
    const categoryNames = new Map<number, string>();

    if (Array.isArray(products)) {
      products.forEach((product) => {
        if (product.category) {
          categoryNames.set(product.id, product.category.name);
        }
      });
    }

    orders.forEach((order) => {
      order.items.forEach((item) => {
        const categoryName = categoryNames.get(item.productId) || 'Unknown';
        const quantity = item.quantity || 1;
        categoryCount.set(
          categoryName,
          (categoryCount.get(categoryName) || 0) + quantity,
        );
      });
    });

    // Convert to percentage
    const totalItems = Array.from(categoryCount.values()).reduce(
      (sum, count) => sum + count,
      0,
    );

    return Array.from(categoryCount.entries())
      .map(([category, count]) => ({
        category,
        percentage:
          totalItems > 0 ? Number(((count / totalItems) * 100).toFixed(2)) : 0,
        count,
      }))
      .sort((a, b) => b.percentage - a.percentage);
  }

  async getFullDashboardData() {
    const [stats, yearlyEarnings, categoryTraffic] = await Promise.all([
      this.getDashboardStats(),
      this.getYearlyEarnings(),
      this.getCategoryTraffic(),
    ]);

    return {
      stats,
      yearlyEarnings,
      categoryTraffic,
    };
  }
}
