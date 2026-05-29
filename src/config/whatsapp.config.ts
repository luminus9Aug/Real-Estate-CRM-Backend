import { registerAs } from '@nestjs/config';

export const whatsappConfig = registerAs('whatsapp', () => ({
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN ?? '',
  twilioWebhookUrl: process.env.TWILIO_WEBHOOK_URL ?? '',
}));
