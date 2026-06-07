import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

function loadEnv() {
  const envPath = path.join(__dirname, '../.env.development');
  if (!fs.existsSync(envPath)) {
    console.error('Env file not found at:', envPath);
    return;
  }
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx === -1) return;
    const key = trimmed.substring(0, idx).trim();
    let val = trimmed.substring(idx + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.substring(1, val.length - 1);
    }
    process.env[key] = val;
  });
}

async function testWorkerDirect() {
  loadEnv();
  const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  console.log('Connecting to Redis:', redisUrl);
  const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });

  const queueName = 'auth-email';

  // Create queue
  const queue = new Queue(queueName, { connection });

  // Start worker
  const worker = new Worker(
    queueName,
    async (job) => {
      console.log('Worker picked up job:', job.id, job.data);
      const { email, name, otp, expiresInMinutes } = job.data;
      const apiKey = process.env.RESEND_API_KEY;
      const fromEmail = process.env.RESEND_OTP_FROM_EMAIL || process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
      const appName = process.env.APP_NAME || 'PropertySales OS';
      const supportEmail = process.env.SUPPORT_EMAIL || 'support@propertysales.os';

      console.log('Sending email using Resend...');
      const response = await axios.post(
        'https://api.resend.com/emails',
        {
          from: fromEmail,
          to: email,
          subject: `${appName} - direct test OTP: ${otp}`,
          html: `<p>Name: ${name}, OTP: ${otp}, Expires: ${expiresInMinutes} mins</p>`,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );
      console.log('Sent! Response:', response.data);
      return response.data;
    },
    { connection }
  );

  console.log('Adding job to queue...');
  const job = await queue.add('test_job', {
    email: 'raj@sunrise.com',
    name: 'Raj Test',
    otp: '123456',
    expiresInMinutes: 5,
  });
  console.log('Job added with ID:', job.id);

  console.log('Waiting 10 seconds for worker to process...');
  await new Promise((resolve) => setTimeout(resolve, 10000));

  await worker.close();
  await queue.close();
  await connection.quit();
  console.log('Done!');
}

testWorkerDirect();
