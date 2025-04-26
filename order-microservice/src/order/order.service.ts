import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { ClientKafka } from '@nestjs/microservices';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private orderRepo: Repository<Order>,

    @InjectRepository(OrderItem)
    private orderItemRepo: Repository<OrderItem>,
    @Inject('KAFKA_ORDER_CLIENT')
    private readonly kafkaClient: ClientKafka,
  ) {}

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

    if ((dto as any).status) {
      order.status = (dto as any).status;
    }

    return this.orderRepo.save(order);
  }

  async deleteOrder(id: number): Promise<void> {
    const order = await this.getOrderById(id);
    await this.orderRepo.remove(order);

    this.kafkaClient.emit('order.deleted', {
      orderId: id,
    });
  }

  async getAllOrders(): Promise<Order[]> {
    return this.orderRepo.find({ relations: ['items'] });
  }
}