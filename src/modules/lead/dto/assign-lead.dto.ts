import { IsNotEmpty, IsString } from 'class-validator';

export class AssignLeadDto {
  @IsString()
  @IsNotEmpty()
  agentId!: string;
}
