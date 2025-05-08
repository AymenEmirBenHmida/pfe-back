// src/seeder/user.seeder.ts

import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Role } from '../user/enums/role.enum';
import { User } from '../user/entities/user.entity';

@Injectable()
export class UserSeeder {
  private readonly logger = new Logger(UserSeeder.name);

  constructor(private dataSource: DataSource) {}

  async run() {
    const userRepository = this.dataSource.getRepository(User);

    const existingAdmin = await userRepository.findOne({
      where: { email: 'admin@example.com' },
    });

    if (existingAdmin) {
      this.logger.log('Admin user already exists. Skipping seeding.');
      return;
    }

    const hashedPassword = await bcrypt.hash('admin123', 10);

    const adminUser = userRepository.create({
      name: 'Admin User',
      email: 'admin@example.com',
      password: hashedPassword,
      role: Role.ADMIN,
      active: true,
    });

    await userRepository.save(adminUser);
    this.logger.log('Admin user seeded successfully.');
  }
}
