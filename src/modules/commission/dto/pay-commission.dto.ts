import { IsOptional, IsString, MaxLength } from 'class-validator';

export class PayCommissionDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  paymentReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
