import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { CreateCartDto } from './dto/create-cart.dto';
import { UpdateCartDto } from './dto/update-cart.dto';
import { Cart } from './entities/cart.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CartItem } from './entities/cart-item.entity';
import { ClientKafka } from '@nestjs/microservices';
import { AddItemDto } from './dto/add-item.dto';
import { ProductService } from 'src/product/product.service';

@Injectable()
export class CartService implements OnModuleInit {
  constructor(
    @InjectRepository(Cart) private cartRepo: Repository<Cart>,
    @InjectRepository(CartItem) private itemRepo: Repository<CartItem>,
    @Inject('KAFKA_CART_CLIENT') private readonly kafkaClient: ClientKafka,
    private productService: ProductService,
  ) {}
  async onModuleInit() {
    this.kafkaClient.subscribeToResponseOf('user.info.getById');
    await this.kafkaClient.connect();
  }

  async getUserInfo(userId: number) {
    return this.kafkaClient
      .send('user.info.getById', { id: userId })
      .toPromise();
  }
  async getCartByUser(userId: string): Promise<Cart> {
    let cart = await this.cartRepo.findOne({
      where: { userId },
      relations: ['items'],
    });

    if (!cart) {
      cart = this.cartRepo.create({ userId, items: [] });
      await this.cartRepo.save(cart);
      return cart;
    }

    // Populate product data for each cart item
    const itemsWithProduct = await Promise.all(
      cart.items.map(async (cartItem) => {
        const product = await this.productService.findOne(
          Number(cartItem.productId),
        );
        return { ...cartItem, product };
      }),
    );

    // Return updated cart with product data
    return { ...cart, items: itemsWithProduct };
  }

  async addItemPlusCheck(
    userId: string,
    productId: string,
    quantity: number,
  ): Promise<Cart> {
    const user = await this.getUserInfo(+userId);

    if (!user) throw new Error('User not found or not authorized.');
    const cart = await this.getCartByUser(userId);
    const existingItem = cart.items.find(
      (item) => item.productId === productId,
    );

    if (existingItem) {
      existingItem.quantity += quantity;
      await this.itemRepo.save(existingItem);
    } else {
      const newItem = this.itemRepo.create({ productId, quantity, cart });
      await this.itemRepo.save(newItem);
    }

    return this.getCartByUser(userId);
  }
  async addItem(
    userId: string,
    productId: string,
    quantity: number,
    cart: Cart,
  ): Promise<CartItem> {
    // Ensure cart items are loaded
    const items = cart.items ?? [];

    // Check for an existing item with the same productId
    const existingItem = items.find((item) => item.productId === productId);

    if (existingItem) {
      // Update quantity if item exists
      existingItem.quantity += quantity;
      return await this.itemRepo.save(existingItem);
    } else {
      // Create and save new item if it doesn't exist
      const newItem = this.itemRepo.create({ productId, quantity, cart });
      return await this.itemRepo.save(newItem);
    }
  }

  async removeItem(userId: string, productId: string): Promise<Cart> {
    const cart = await this.getCartByUser(userId);
    cart.items = cart.items.filter((item) => item.productId !== productId);
    await this.cartRepo.save(cart);
    return this.getCartByUser(userId);
  }
  async removeItems(userId: string) {
    const cart = await this.getCartByUser(userId);

    return this.cartRepo.remove(cart);
  }
  async removecarts(userId: string) {
    const cart = await this.getCartByUser(userId);
    const carts = await this.cartRepo.find();
    carts.map(async (cart0) => {
      await this.cartRepo.remove(cart0);
    });
    return 'succeed';
  }

  async handleItems(userId: string, body: AddItemDto[]) {
    console.log('handleItems ', body);
    const cart = await this.getCartByUser(userId);

    for (const { productId, quantity } of body) {
      const existingItem = await this.itemRepo.findOne({
        where: {
          cart: { id: cart.id },
          productId: productId,
        },
      });

      if (existingItem) {
        await this.itemRepo.save(existingItem);
      } else {
        const newItem = this.itemRepo.create({ productId, quantity, cart });
        await this.itemRepo.save(newItem);
      }
    }

    return this.getCartByUser(userId); // return updated cart
  }
  createCart(createCartDto: CreateCartDto) {
    return this.cartRepo.save(createCartDto);
  }

  findAll() {
    return `This action returns all cart`;
  }

  findOne(id: number) {
    return `This action returns a #${id} cart`;
  }

  update(id: number, updateCartDto: UpdateCartDto) {
    return `This action updates a #${id} cart`;
  }

  remove(id: number) {
    return `This action removes a #${id} cart`;
  }
}
