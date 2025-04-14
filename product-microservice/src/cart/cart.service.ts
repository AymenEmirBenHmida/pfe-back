import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { CreateCartDto } from './dto/create-cart.dto';
import { UpdateCartDto } from './dto/update-cart.dto';
import { Cart } from './entities/cart.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CartItem } from './entities/cart-item.entity';
import { ClientKafka } from '@nestjs/microservices';

@Injectable()
export class CartService implements OnModuleInit {
  constructor(
    @InjectRepository(Cart) private cartRepo: Repository<Cart>,
    @InjectRepository(CartItem) private itemRepo: Repository<CartItem>,
    @Inject('KAFKA_SERVICE') private readonly kafkaClient: ClientKafka,
  ) {}
  async onModuleInit() {
    this.kafkaClient.subscribeToResponseOf('user.info.getById');
    await this.kafkaClient.connect();
  }

  async getUserInfo(userId: number) {
    return this.kafkaClient.send('user.info.getById', { id: userId }).toPromise();
  }
  async getCartByUser(userId: string): Promise<Cart> {
    let cart = await this.cartRepo.findOne({ where: { userId } });
    if (!cart) {
      cart = this.cartRepo.create({ userId, items: [] });
      await this.cartRepo.save(cart);
    }
    return cart;
  }

  async addItem(
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

  async removeItem(userId: string, productId: string): Promise<Cart> {
    const cart = await this.getCartByUser(userId);
    cart.items = cart.items.filter((item) => item.productId !== productId);
    await this.cartRepo.save(cart);
    return this.getCartByUser(userId);
  }
  create(createCartDto: CreateCartDto) {
    return 'This action adds a new cart';
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
