import axios from 'axios';

async function testHttpForgot() {
  const url = 'http://localhost:3001/api/v1/auth/forgot-password';
  const payload = {
    email: 'raj@sunrise.com',
    subdomain: 'sunrise-realty',
  };

  console.log(`Sending POST request to ${url} with payload:`, payload);
  try {
    const res = await axios.post(url, payload);
    console.log('Success! Status:', res.status);
    console.log('Response data:', res.data);
  } catch (err: any) {
    console.error('Failed! Status:', err.response?.status);
    console.error('Error Response data:', err.response?.data || err.message);
  }
}

testHttpForgot();
