import { IsEnum } from 'class-validator';
import { SupportedLanguage } from '@prisma/client';

export class UpdateLanguageDto {
  @IsEnum(SupportedLanguage)
  language!: SupportedLanguage;
}
