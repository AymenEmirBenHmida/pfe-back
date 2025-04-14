import { Category } from 'src/category/entities/category.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm';
@Entity({ name: 'product' })
export class Product {
  @PrimaryGeneratedColumn()
  id: number;
  @Column()
  name: string;
  @Column({ type: 'numeric', precision: 10, scale: 2 })
  price: number;
  @Column()
  stock: number;
  @Column({ nullable: true })
  brand: string;
  @CreateDateColumn()
  createdAt: Date;
  @UpdateDateColumn()
  updatedAt: Date;
  @Column({ type: 'jsonb', nullable: true })
  characteristics: Record<string, string>;
  @Column()
  description: string;
  @Column()
  categoryId: number;
  @ManyToOne(() => Category, (category) => category.products)
  @JoinColumn({ name: 'categoryId' })
  category: Category;
  // Add virtual relation to files
  @Column('text', { array: true, nullable: true })
  files: string[];
  // Optional: Add a getter method to easily get main image
  // get mainImage(): File | undefined {
  //   if (!this.files || !this.files.length) return undefined;
  //   return this.files.find((file) => file.isMain) || this.files[0];
  // }
  // // Optional: Add a getter method to easily get gallery images
  // get galleryImages(): File[] {
  //   if (!this.files || !this.files.length) return [];
  //   return this.files.filter((file) => !file.isMain);
  // }
}
