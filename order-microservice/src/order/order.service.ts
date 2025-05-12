import {
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { ClientKafka } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { OrderFilterDto } from './dto/order-filter.dto';

@Injectable()
export class OrderService implements OnModuleInit {
  constructor(
    @InjectRepository(Order)
    private orderRepo: Repository<Order>,

    @InjectRepository(OrderItem)
    private orderItemRepo: Repository<OrderItem>,
    @Inject('KAFKA_ORDER_CLIENT')
    private readonly kafkaClient: ClientKafka,
  ) {}

  async onModuleInit() {
    // List of ALL topics that this service needs to subscribe to
    const topics = [
      'user.getUsersByIds',
      'order.confirmProductOrder',
      'product.getProductsByIds',
    ];

    // Subscribe to the reply topics
    topics.forEach((topic) => this.kafkaClient.subscribeToResponseOf(topic));

    try {
      await this.kafkaClient.connect();
      console.log('Order service connected to Kafka');
    } catch (error) {
      console.error(`Failed to connect to Kafka: ${error.message}`);
    }
  }

  async createOrder(dto: CreateOrderDto): Promise<Order> {
    const order = new Order();
    order.userId = dto.userId;
    order.shippingAddress = dto.shippingAddress;

    const items: OrderItem[] = dto.items.map((item) => {
      const orderItem = new OrderItem();
      orderItem.productId = item.productId;
      orderItem.quantity = item.quantity;
      orderItem.price = item.price;
      return orderItem;
    });

    order.items = items;
    order.amount = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );

    const savedOrder = await this.orderRepo.save(order);

    this.kafkaClient.emit('order.created', {
      orderId: savedOrder.id,
      userId: savedOrder.userId,
      amount: savedOrder.amount,
    });

    return savedOrder;
  }
  async findAllFilteredOrders({
    page,
    limit,
    userId,
    status,
    minAmount,
    maxAmount,
    sortBy = 'createdAt',
    sortOrder = 'DESC',
  }: OrderFilterDto) {
    const query = this.orderRepo
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'item'); // Join with order items    const currentPage = page ? Number(page) : 1;
    const currentLimit = limit ? Number(limit) : 10;
    const currentPage = page ? Number(page) : 1;
    if (userId !== undefined) {
      query.andWhere('order.userId = :userId', { userId });
    }

    if (status) {
      query.andWhere('order.status = :status', { status });
    }

    if (minAmount !== undefined) {
      query.andWhere('order.amount >= :minAmount', { minAmount });
    }

    if (maxAmount !== undefined) {
      query.andWhere('order.amount <= :maxAmount', { maxAmount });
    }

    query.orderBy(`order.${sortBy}`, sortOrder.toUpperCase() as 'ASC' | 'DESC');
    query.skip((currentPage - 1) * currentLimit).take(currentLimit);

    const [data, total] = await query.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / currentLimit),
    };
  }

  async getOrdersByUser(userId: number): Promise<Order[]> {
    return this.orderRepo.find({ where: { userId }, relations: ['items'] });
  }

  async getOrderById(id: number): Promise<Order> {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: ['items'],
    });
    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }
    return order;
  }
  async getOrdersByProductIdAndUserId(
    userId: number,
    productId: number,
  ): Promise<boolean> {
    const orders = await this.orderRepo.find({
      where: { userId },
      relations: ['items'],
    });
    // Filter orders that contain the specified product
    const ordersWithProduct = orders.filter((order) =>
      order.items.some((item) => item.productId === productId),
    );
    if (ordersWithProduct.length > 0) return true;
    else return false;
  }

  async updateOrderStatus(id: number, status: string): Promise<Order> {
    const order = await this.orderRepo.findOneBy({ id });
    if (!order) throw new Error('Order not found');
    order.status = status as any;
    const updated = await this.orderRepo.save(order);

    this.kafkaClient.emit('order.status.updated', {
      orderId: updated.id,
      status: updated.status,
    });

    return updated;
  }

  async updateOrder(id: number, dto: UpdateOrderDto): Promise<Order> {
    const order = await this.getOrderById(id);

    if (dto.shippingAddress) {
      order.shippingAddress = dto.shippingAddress;
    }

    if (dto.status) {
      order.status = dto.status as any;
    }

    // Only allow updating items if order is still pending
    if (dto.items && order.status === 'pending') {
      // Remove old items
      await this.orderItemRepo.remove(order.items);

      // Create new items
      const newItems = dto.items.map((itemDto) => {
        const item = new OrderItem();
        item.productId = itemDto.productId;
        item.quantity = itemDto.quantity;
        item.price = itemDto.price;
        return item;
      });

      order.items = newItems;

      // Recalculate amount
      order.amount = newItems.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      );
    }

    const updatedOrder = await this.orderRepo.save(order);

    this.kafkaClient.emit('order.updated', {
      orderId: updatedOrder.id,
    });

    return updatedOrder;
  }

  async deleteOrder(id: number): Promise<void> {
    const order = await this.getOrderById(id);
    await this.orderRepo.remove(order);

    this.kafkaClient.emit('order.deleted', {
      orderId: id,
    });
  }

  async getAllOrders(): Promise<Order[]> {
    // Fetch orders with their items
    const orders = await this.orderRepo.find({ relations: ['items'] });

    // Collect all product IDs from order items
    const productIds = orders.flatMap((order) =>
      order.items.map((item) => item.productId),
    );

    // Remove duplicates
    const uniqueProductIds = [...new Set(productIds)];

    // Fetch product details from product service via Kafka
    const products = await firstValueFrom(
      this.kafkaClient.send('product.getProductsByIds', {
        ids: uniqueProductIds,
      }),
    );

    // Create a map for quick product lookup
    const productMap = new Map();
    if (Array.isArray(products)) {
      products.forEach((product) => {
        productMap.set(product.id, product);
      });
    }

    // Enhance order items with product details
    return orders.map((order) => ({
      ...order,
      items: order.items.map((item) => ({
        ...item,
        product: productMap.get(item.productId) || {
          id: item.productId,
          name: 'Unknown Product',
        },
      })),
    }));
  }
}
