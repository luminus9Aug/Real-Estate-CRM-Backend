import { IsBoolean } from 'class-validator';

export class ToggleFullAccessDto {
  @IsBoolean()
  hasFullDataAccess!: boolean;
}
