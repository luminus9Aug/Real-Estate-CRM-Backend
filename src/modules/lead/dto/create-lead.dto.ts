import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { LeadSource, LeadStatus, SupportedLanguage } from '@prisma/client';

export class CreateLeadDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  phone!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  alternatePhone?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  budgetMin?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  budgetMax?: number;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @IsOptional()
  @IsEnum(LeadSource)
  source?: LeadSource;

  @IsOptional()
  @IsEnum(SupportedLanguage)
  preferredLanguage?: SupportedLanguage;

  @IsOptional()
  @IsString()
  preferredPropertyId?: string;
}
