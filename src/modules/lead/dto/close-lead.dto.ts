import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CloseLeadDto {
  @IsString()
  @IsNotEmpty()
  closedPropertyId!: string;

  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  finalSaleValue!: number;
}
