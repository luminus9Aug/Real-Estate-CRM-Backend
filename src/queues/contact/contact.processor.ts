import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import axios from 'axios';
import type { ContactJobPayload } from './contact-job.interface';
import { CONTACT_QUEUE } from './contact.producer';

@Processor(CONTACT_QUEUE)
export class ContactProcessor extends WorkerHost {
  private readonly logger = new Logger(ContactProcessor.name);

  async process(job: Job<ContactJobPayload>): Promise<void> {
    const { name, email, subject, message } = job.data;
    this.logger.log(`Processing contact us email job ${job.id} for: ${name} (${email})`);

    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
    const toEmail = 'luminusyv@gmail.com';

    if (!apiKey) {
      this.logger.error('RESEND_API_KEY is not defined in environment variables');
      throw new Error('RESEND_API_KEY is not defined');
    }

    try {
      const response = await axios.post(
        'https://api.resend.com/emails',
        {
          from: fromEmail,
          to: toEmail,
          subject: `PropertySales OS - Contact Query: ${subject}`,
          html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; border: 1px solid #eee; border-radius: 8px;">
              <h2 style="color: #2563eb; margin-top: 0;">New Contact Submission</h2>
              <hr style="border: 0; border-top: 1px solid #eee; margin: 15px 0;" />
              <p><strong>Name:</strong> ${name}</p>
              <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
              <p><strong>Subject:</strong> ${subject}</p>
              <hr style="border: 0; border-top: 1px solid #eee; margin: 15px 0;" />
              <p><strong>Message:</strong></p>
              <blockquote style="background: #f9fafb; border-left: 4px solid #d1d5db; padding: 10px 15px; margin: 0; color: #4b5563; font-style: italic;">
                ${message.replace(/\n/g, '<br />')}
              </blockquote>
              <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
              <p style="font-size: 11px; color: #9ca3af; text-align: center; margin-bottom: 0;">
                Sent asynchronously from PropertySales OS Email Queue via Resend.
              </p>
            </div>
          `,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      this.logger.log(
        `Successfully sent contact us email via Resend. Resend Response ID: ${response.data.id}`
      );
    } catch (error: any) {
      const errorMsg = error.response?.data ? JSON.stringify(error.response.data) : error.message;
      this.logger.error(`Failed to send email via Resend: ${errorMsg}`);
      throw error; // Retrigger job retry via BullMQ
    }
  }
}
