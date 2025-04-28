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

  // Ensure productId is valid
  private isValidProductId(productId: any): boolean {
    return !isNaN(Number(productId)) && Number(productId) > 0;
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

    const itemsWithProduct = await Promise.all(
      cart.items.map(async (cartItem) => {
        const productId = Number(cartItem.productId);

        if (!this.isValidProductId(cartItem.productId)) {
          console.error(`Invalid productId: ${cartItem.productId}`); // Log invalid productId
          return { ...cartItem, product: null }; // Optionally handle null product
        }

        const product = await this.productService.findOne(productId);
        return { ...cartItem, product };
      }),
    );

    return { ...cart, items: itemsWithProduct };
  }

  async addItemPlusCheck(userId: number, { productId, quantity }: AddItemDto) {
    const cart = await this.cartRepo.findOne({
      where: { userId: String(userId) }, // Cast to string to match database schema
      relations: ['items'],
    });

    if (!cart) {
      throw new Error('Cart not found');
    }

    const existingItem = cart.items.find(
      (item) => item.productId === productId,
    );

    if (existingItem) {
      // Update quantity if item exists
      existingItem.quantity += quantity;
      await this.itemRepo.save(existingItem);
    } else {
      // Insert new cart item
      const newItem = this.itemRepo.create({
        id: cart.id,
        productId,
        quantity,
      });
      await this.itemRepo.save(newItem);
    }
  }

  async addItem(
    userId: string,
    productId: string,
    quantity: number,
    cart: Cart,
  ): Promise<CartItem> {
    const items = cart.items ?? [];

    // Check for valid productId
    if (!this.isValidProductId(productId)) {
      throw new Error(`Invalid productId: ${productId}`);
    }

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
      if (!this.isValidProductId(productId)) {
        console.error(`Invalid productId: ${productId}`); // Log invalid productId
        continue; // Skip this iteration for invalid productId
      }

      const existingItem = await this.itemRepo.findOne({
        where: {
          cart: { id: cart.id },
          productId: productId,
        },
      });

      if (existingItem) {
        existingItem.quantity = quantity;
        await this.itemRepo.save(existingItem);
      } else {
        const newItem = this.itemRepo.create({ productId, quantity, cart });
        await this.itemRepo.save(newItem);
      }
    }

    return this.getCartByUser(userId); // Return updated cart
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
