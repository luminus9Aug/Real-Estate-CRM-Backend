import { IsEmail, IsNotEmpty, IsNumberString, Length } from 'class-validator';

export class VerifyOtpDto {
  @IsEmail()
  email!: string;

  @IsNotEmpty()
  subdomain!: string;

  @IsNumberString()
  @Length(6, 6)
  otp!: string;
}
