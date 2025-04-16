import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { CreateCartDto } from './dto/create-cart.dto';
import { UpdateCartDto } from './dto/update-cart.dto';
import { AddItemDto } from './dto/add-item.dto';

@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}
  // Update ,Delete or Add by batch
  @Post(':userId/items')
  handleItems(@Param('userId') userId: string, @Body() body: AddItemDto[]) {
    console.log('handleItems controller ', body);
    return this.cartService.handleItems(userId, body);
  }

  @Post(':userId/item')
  addItem(@Param('userId') userId: string, @Body() body: AddItemDto) {
    return this.cartService.addItemPlusCheck(
      userId,
      body.productId,
      body.quantity,
    );
  }

  @Delete(':userId/item/:productId')
  removeItem(
    @Param('userId') userId: string,
    @Param('productId') productId: string,
  ) {
    return this.cartService.removeItem(userId, productId);
  }
  @Delete(':userId/items')
  removeCart(@Param('userId') userId: string) {
    return this.cartService.removeItems(userId);
  }
  @Delete('')
  removeCarts(@Param('userId') userId: string) {
    return this.cartService.removecarts(userId);
  }
  // Get a cart by the user id
  @Get(':userId')
  getCart(@Param('userId') userId: number) {
    return this.cartService.getCartByUser(userId.toString());
  }

  @Post()
  create(@Body() createCartDto: CreateCartDto) {
    return this.cartService.createCart(createCartDto);
  }

  @Get()
  findAll() {
    return this.cartService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.cartService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCartDto: UpdateCartDto) {
    return this.cartService.update(+id, updateCartDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.cartService.remove(+id);
  }
}
