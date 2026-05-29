import { IsBoolean, IsDate, IsEmail, IsEnum, IsNumber, IsOptional, IsString, IsUrl, MaxLength, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { UserRole, CommissionType, Gender } from '@prisma/client';

export class UpdateUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsEnum(CommissionType)
  commissionType?: CommissionType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  commissionRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fixedCommissionAmount?: number;

  @IsOptional()
  @IsString()
  @IsUrl()
  avatarUrl?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  birthday?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  anniversary?: Date;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
