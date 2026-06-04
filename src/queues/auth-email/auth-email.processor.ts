import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import axios from 'axios';
import type { AuthEmailJobPayload } from './auth-email-job.interface';
import { AUTH_EMAIL_QUEUE } from './auth-email.producer';
import { getOtpEmailTemplate } from '../../modules/auth/templates/otp-email.template';

@Processor(AUTH_EMAIL_QUEUE)
export class AuthEmailProcessor extends WorkerHost {
  private readonly logger = new Logger(AuthEmailProcessor.name);

  async process(job: Job<AuthEmailJobPayload>): Promise<void> {
    const { email, name, otp, expiresInMinutes } = job.data;
    this.logger.log(`Processing OTP email job ${job.id} for: ${name} (${email})`);

    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail =
      process.env.RESEND_OTP_FROM_EMAIL ||
      process.env.RESEND_FROM_EMAIL ||
      'onboarding@resend.dev';
    const appName = process.env.APP_NAME || 'PropertySales OS';
    const supportEmail = process.env.SUPPORT_EMAIL || 'support@propertysales.os';

    if (!apiKey) {
      this.logger.error('RESEND_API_KEY is not defined in environment variables');
      throw new Error('RESEND_API_KEY is not defined');
    }

    const htmlContent = getOtpEmailTemplate({
      name,
      otp,
      expiresInMinutes,
      appName,
      supportEmail,
    });

    try {
      const response = await axios.post(
        'https://api.resend.com/emails',
        {
          from: fromEmail,
          to: email,
          subject: `${appName} - Verification Code: ${otp}`,
          html: htmlContent,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      this.logger.log(
        `Successfully sent OTP email via Resend to ${email}. Resend Response ID: ${response.data.id}`
      );
    } catch (error: any) {
      const errorMsg = error.response?.data ? JSON.stringify(error.response.data) : error.message;
      this.logger.error(`Failed to send OTP email to ${email} via Resend: ${errorMsg}`);
      throw error; // Retrigger job retry via BullMQ
    }
  }
}
