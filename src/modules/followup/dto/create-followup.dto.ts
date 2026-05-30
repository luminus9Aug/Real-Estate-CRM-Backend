import { Type } from 'class-transformer';
import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateFollowupDto {
  @IsString()
  @IsNotEmpty()
  leadId!: string;

  @IsString()
  @IsNotEmpty()
  assignedToId!: string;

  @IsDateString()
  @IsNotEmpty()
  dueAt!: string;

  @IsOptional()
  @IsString()
  message?: string;
}
