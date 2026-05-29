import { PipeTransform, Injectable, ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    if (metadata.type !== 'body') {
      return value;
    }

    try {
      const parsedValue = this.schema.parse(value);
      return parsedValue;
    } catch (error) {
      if (error instanceof ZodError) {
        console.error('Zod Validation Error:', JSON.stringify(error.errors, null, 2));
        throw new BadRequestException({
          message: 'Validation failed',
          errors: error.errors,
        });
      }
      throw new BadRequestException('Validation failed');
    }
  }
}
