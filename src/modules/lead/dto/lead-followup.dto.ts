import { Type } from 'class-transformer';
import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LeadFollowupDto {
  @IsDateString()
  @IsNotEmpty()
  dueAt!: string;

  @IsOptional()
  @IsString()
  message?: string;

  @IsString()
  @IsNotEmpty()
  assignedToId!: string;
}
