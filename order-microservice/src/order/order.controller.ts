import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Put,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';

@Controller('order')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  // ✅ Create a new order
  @Post()
  async createOrder(@Body() dto: CreateOrderDto) {
    console.log('create order :', dto);
    return this.orderService.createOrder(dto);
  }

  // ✅ Get all orders (admin)
  @Get()
  async getAll() {
    return this.orderService.getAllOrders();
  }

  // ✅ Get orders by user ID
  @Get('user/:userId')
  async getByUser(@Param('userId') userId: number) {
    return this.orderService.getOrdersByUser(userId);
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
}
