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

async function testResend() {
  loadEnv();
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_OTP_FROM_EMAIL || process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
  const toEmail = 'raj@sunrise.com';

  console.log('API Key:', apiKey ? 'FOUND (starts with ' + apiKey.substring(0, 5) + '...)' : 'MISSING');
  console.log('From Email:', fromEmail);
  console.log('To Email:', toEmail);

  if (!apiKey) {
    console.error('No API key found!');
    return;
  }

  try {
    const response = await axios.post(
      'https://api.resend.com/emails',
      {
        from: fromEmail,
        to: toEmail,
        subject: 'Test Email from PropertySales OS',
        html: '<p>This is a direct test of the Resend integration.</p>',
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log('Success! Response:', response.data);
  } catch (err: any) {
    console.error('Failed to send email:', err.response?.data || err.message);
  }
}

testResend();
