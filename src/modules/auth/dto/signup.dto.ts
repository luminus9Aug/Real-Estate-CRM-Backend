import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class SignupDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  tenantName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  subdomain!: string;

  @IsEmail()
  ownerEmail!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  ownerName!: string;
}
