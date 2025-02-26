import { IsEmail, IsStrongPassword } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;
  name: string;
  @IsStrongPassword()
  password: string;
}
