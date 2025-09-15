import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Put,
  Query,
  Req,
  RawBodyRequest,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { OrderFilterDto } from './dto/order-filter.dto';

@Controller('order')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  // ✅ Create a new order
  @Post()
  async createOrder(@Body() dto: CreateOrderDto) {
    console.log('create order :', dto);
    return this.orderService.createOrder(dto);
  }

  // // ✅ Get all orders (admin)
  // @Get()
  // async getAll() {
  //   return this.orderService.getAllOrders();
  // }

  // ✅ Get orders by user ID
  @Get('user/:userId')
  async getByUser(@Param('userId') userId: number) {
    return this.orderService.getOrdersByUser(userId);
  }
  @Post('create-checkout-session')
  async createCheckoutSession(
    // 👈 FIX 4: Add shippingAddress to the body
    @Body() body: { items: any[]; userId: number; shippingAddress: string },
  ) {
    return this.orderService.createCheckoutSession(
      body.items,
      body.userId,
      body.shippingAddress,
    );
  }
  // ✅ Handle incoming webhooks from Stripe
  @Post('stripe-webhook')
  async handleStripeWebhook(@Req() req: RawBodyRequest<Request>) {
    // This now works because @Req, RawBodyRequest, and Request are imported
    return this.orderService.handleStripeWebhook(
      req.rawBody!,
      req.headers['stripe-signature'],
    );
  }
  @Get('by-session/:sessionId') // 👈 ADD THIS NEW ENDPOINT
  async getBySessionId(@Param('sessionId') sessionId: string) {
    return this.orderService.getOrderBySessionId(sessionId);
  }
  // ✅ Get a single order by ID
  @Get(':id')
  async getById(@Param('id') id: number) {
    return this.orderService.getOrderById(id);
  }

  // ✅ Update order (shipping address / status)
  @Patch(':id')
  async update(@Param('id') id: number, @Body() dto: UpdateOrderDto) {
    return this.orderService.updateOrder(id, dto);
  }

  // ✅ Update only status (alternative endpoint)
  @Put(':id/status/:status')
  async updateOrderStatus(
    @Param('id') id: number,
    @Param('status') status: string,
  ) {
    return this.orderService.updateOrderStatus(id, status);
  }

  // ✅ Delete/cancel an order
  @Delete(':id')
  async delete(@Param('id') id: number) {
    return this.orderService.deleteOrder(id);
  }
  @MessagePattern('order.confirmProductOrder')
  async getUsersByIds(@Payload() data: { userId: number; productId: number }) {
    return this.orderService.getOrdersByProductIdAndUserId(
      data.userId,
      data.productId,
    );
  }
  @Get()
  async getOrders(@Query() query: OrderFilterDto) {
    return this.orderService.findAllFilteredOrders(query);
  }
}
