import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn
} from 'typeorm';

export enum FileType {
  PRODUCT_IMAGE = 'product_image',
  CATEGORY_IMAGE = 'category_image',
  DOCUMENT = 'document',
}

@Entity({ name: 'file' })
export class File {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  filename: string;

  @Column()
  path: string;

  @Column()
  mimetype: string;

  @Column({ nullable: true })
  size: number;

  @Column({
    type: 'enum',
    enum: FileType,
    default: FileType.DOCUMENT,
  })
  type: FileType;

  @Column({ nullable: true })
  alt: string;

  @Column({ default: false })
  isMain: boolean;

  @Column({ default: 0 })
  displayOrder: number;

  // Keep the generic approach
  @Column({ nullable: true })
  entityId: number;

  @Column({ nullable: true })
  entityType: string;


  @CreateDateColumn()
  uploadedAt: Date;
}
