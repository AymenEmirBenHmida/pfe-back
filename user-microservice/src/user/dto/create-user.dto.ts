import { IsEmail, IsOptional, IsStrongPassword } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;
  name: string;
  @IsStrongPassword()
  password: string;
  @IsOptional()
  profileImageUrl?: any;
}
