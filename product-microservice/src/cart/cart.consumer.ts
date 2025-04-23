// cart.consumer.ts
import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { CartService } from './cart.service';

@Controller()
export class CartConsumer {
  constructor(private readonly cartService: CartService) {}

  @EventPattern('product-added-to-cart')
  async handleProductAdd(@Payload() data: any) {
    const { userId, productId, quantity } = data;
    await this.cartService.addItemPlusCheck(userId, productId, quantity);
  }
}
