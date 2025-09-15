import {
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { ClientKafka } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { OrderFilterDto } from './dto/order-filter.dto';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OrderService implements OnModuleInit {
  private stripe: Stripe;

  constructor(
    @InjectRepository(Order)
    private orderRepo: Repository<Order>,

    @InjectRepository(OrderItem)
    private orderItemRepo: Repository<OrderItem>,
    @Inject('KAFKA_ORDER_CLIENT')
    private readonly kafkaClient: ClientKafka,
    private readonly configService: ConfigService,
  ) {
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    this.stripe = new Stripe(stripeSecretKey!, {
      apiVersion: '2025-07-30.basil', // ✅ NEW, CORRECT VERSION
    });
  }

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

  async createCheckoutSession(
    items: any[],
    userId: number,
    shippingAddress: string,
  ) {
    const orderDto: CreateOrderDto = {
      userId,
      shippingAddress,
      items: items.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
        price: item.product.price,
      })),
    };
    const preliminaryOrder = await this.createOrder(
      orderDto,
      OrderStatus.PENDING_PAYMENT,
    );

    const line_items = items.map((item) => ({
      price_data: {
        currency: 'usd',
        product_data: { name: item.product.name },
        unit_amount: Math.round(item.product.price * 100),
      },
      quantity: item.quantity,
    }));

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items,
      mode: 'payment',
      success_url: `${this.configService.get('FRONTEND_URL')}/order/${preliminaryOrder.id}?clear_cart=true`,
      cancel_url: `${this.configService.get('FRONTEND_URL')}/cart`,
      metadata: {
        orderId: preliminaryOrder.id,
      },
    });
    return { url: session.url };
  }

  async handleStripeWebhook(payload: Buffer, signature: string) {
    const webhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    );
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret!,
      );
    } catch (err) {
      throw new Error(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = parseInt(session.metadata!.orderId, 10);
      try {
        // We are no longer creating an order here, just updating its status
        await this.updateOrderStatus(orderId, OrderStatus.PENDING);
        console.log(`✅ Order ${orderId} status updated to PENDING.`);
      } catch (error) {
        console.error(`Failed to update status for order ${orderId}`, error);
        // You might want to add retry logic or alerts here
      }
    }

    // Optional: Handle if the user closes the Stripe page (payment expires)
    if (event.type === 'checkout.session.expired') {
      const session = event.data.object as any;
      const orderId = parseInt(session.metadata!.orderId, 10);
      await this.updateOrderStatus(orderId, OrderStatus.CANCELLED);
    }

    return { received: true };
  }

  async getOrderBySessionId(sessionId: string): Promise<Order> {
    const order = await this.orderRepo.findOne({
      where: { stripeSessionId: sessionId },
      relations: ['items'],
    });
    if (!order) {
      throw new NotFoundException(
        `Order with session ID ${sessionId} not found`,
      );
    }
    return order;
  }
  async createOrder(
    dto: CreateOrderDto,
    status: OrderStatus = OrderStatus.PENDING, // Accept an optional status, defaulting to PENDING
  ): Promise<Order> {
    const order = new Order();

    // CRITICAL FIX: Ensure userId is valid before proceeding.
    // This prevents the "NaN" database error.
    if (isNaN(dto.userId) || dto.userId == null) {
      console.error(
        'Attempted to create order with invalid userId:',
        dto.userId,
      );
      throw new Error(
        'Invalid userId provided to createOrder. Cannot be NaN or null.',
      );
    }

    order.userId = dto.userId;
    order.shippingAddress = dto.shippingAddress;
    order.status = status; // Set the status from the parameter

    // This part remains the same: create the OrderItem entities from the DTO
    const items: OrderItem[] = dto.items.map((itemDto) => {
      const orderItem = new OrderItem();
      orderItem.productId = itemDto.productId;
      orderItem.quantity = itemDto.quantity;
      orderItem.price = itemDto.price;
      return orderItem;
    });

    order.items = items;

    // This part remains the same: calculate the total amount
    order.amount = items.reduce(
      (sum, currentItem) => sum + currentItem.price * currentItem.quantity,
      0,
    );

    // Save the fully constructed order to the database
    const savedOrder = await this.orderRepo.save(order);

    // Emit a Kafka event to notify other services that an order was created
    this.kafkaClient.emit('order.created', {
      orderId: savedOrder.id,
      userId: savedOrder.userId,
      amount: savedOrder.amount,
      status: savedOrder.status, // Also include the status in the event
    });

    // Return the newly saved order
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
    const currentPage = Math.max(Number(page) || 1, 1);
    const currentLimit = Math.max(Number(limit) || 10, 1);
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
      page: currentPage,
      limit: currentLimit,
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
