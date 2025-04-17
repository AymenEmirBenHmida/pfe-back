import { IsEmail, IsOptional, IsStrongPassword } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({
    example: 'john.doe@example.com',
    description: 'User email address',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'John Doe',
    description: 'Full name of the user',
  })
  name: string;

  @ApiProperty({
    example: 'Str0ngP@ssword!',
    description: 'User password, must meet strong password criteria',
  })
  @IsStrongPassword()
  password: string;

  @ApiPropertyOptional({
    example: '/uploads/profiles/default.png',
    description: 'Optional profile image URL or path',
  })
  @IsOptional()
  profileImageUrl?: any;
}
