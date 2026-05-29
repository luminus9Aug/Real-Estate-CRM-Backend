import { registerAs } from '@nestjs/config';

export const billingConfig = registerAs('billing', () => ({
  razorpayKeyId: process.env.RAZORPAY_KEY_ID,
  razorpaySecret: process.env.RAZORPAY_SECRET,
  webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
}));
