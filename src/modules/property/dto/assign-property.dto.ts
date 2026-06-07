import { IsOptional, IsString } from 'class-validator';

export class AssignPropertyDto {
  @IsString()
  @IsOptional()
  agentId?: string | null;
}
