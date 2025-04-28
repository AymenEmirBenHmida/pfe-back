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
import { ApiBody, ApiOperation, ApiParam } from '@nestjs/swagger';

@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}
  // Update ,Delete or Add by batch
  @Post(':userId/items')
  @ApiOperation({ summary: 'Batch add, update, or delete items in the cart' })
  @ApiParam({ name: 'userId', type: String })
  @ApiBody({ type: [AddItemDto] })
  handleItems(@Param('userId') userId: string, @Body() body: AddItemDto[]) {
    console.log('handleItems controller ', body);
    return this.cartService.handleItems(userId, body);
  }

  @Post(':userId/item')
  @ApiOperation({ summary: 'Add a single item to the cart' })
  @ApiParam({ name: 'userId', type: String })
  @ApiBody({ type: AddItemDto })
  addItem(@Param('userId') userId: string, @Body() body: AddItemDto) {
    console.log('user id ', userId, ', body ', body);
    return this.cartService.addItemPlusCheck(+userId, body);
  }

  @Delete(':userId/item/:productId')
  @ApiOperation({ summary: 'Remove a specific item from the cart' })
  @ApiParam({ name: 'userId', type: String })
  @ApiParam({ name: 'productId', type: String })
  removeItem(
    @Param('userId') userId: string,
    @Param('productId') productId: string,
  ) {
    return this.cartService.removeItem(userId, productId);
  }
  @Delete(':userId/items')
  @ApiOperation({ summary: "Remove all items from a user's cart" })
  @ApiParam({ name: 'userId', type: String })
  removeCart(@Param('userId') userId: string) {
    return this.cartService.removeItems(userId);
  }
  @Delete('')
  @ApiOperation({ summary: 'Clear all carts (admin use only)' })
  removeCarts(@Param('userId') userId: string) {
    return this.cartService.removecarts(userId);
  }
  // Get a cart by the user id
  @Get(':userId')
  @ApiOperation({ summary: "Get a user's cart by userId" })
  @ApiParam({ name: 'userId', type: Number })
  getCart(@Param('userId') userId: number) {
    return this.cartService.getCartByUser(userId.toString());
  }

  @Post()
  @ApiOperation({ summary: 'Create a new cart' })
  @ApiBody({ type: CreateCartDto })
  create(@Body() createCartDto: CreateCartDto) {
    return this.cartService.createCart(createCartDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all carts' })
  findAll() {
    return this.cartService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a cart by its ID' })
  @ApiParam({ name: 'id', type: String })
  findOne(@Param('id') id: string) {
    return this.cartService.findOne(+id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a cart by ID' })
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ type: UpdateCartDto })
  update(@Param('id') id: string, @Body() updateCartDto: UpdateCartDto) {
    return this.cartService.update(+id, updateCartDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a cart by ID' })
  @ApiParam({ name: 'id', type: String })
  remove(@Param('id') id: string) {
    return this.cartService.remove(+id);
  }
}
