import { Entity, PrimaryGeneratedColumn, Column, Unique } from 'typeorm';

@Entity('reviews')
@Unique(['userId', 'productId']) // ✅ Only one review per user/product
export class Review {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column()
  productId: number;

  @Column({ type: 'int' }) // for stars (1–5)
  rating: number;

  @Column({ nullable: true })
  comment: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
