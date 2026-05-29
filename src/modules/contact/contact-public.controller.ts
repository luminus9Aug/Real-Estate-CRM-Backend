import { Controller, Post, Body } from '@nestjs/common';
import { ContactProducer } from '../../queues/contact/contact.producer';
import { ContactSubmissionDto } from './dto/contact-submission.dto';
import { Public } from '../../common/decorators/public.decorator';

@Controller('contact')
@Public()
export class ContactPublicController {
  constructor(private readonly contactProducer: ContactProducer) {}

  @Post()
  async submitContactForm(@Body() dto: ContactSubmissionDto) {
    await this.contactProducer.enqueue({
      name: dto.name,
      email: dto.email,
      subject: dto.subject,
      message: dto.message,
    });
    return { success: true, message: 'Your message has been received and queued for sending.' };
  }
}
