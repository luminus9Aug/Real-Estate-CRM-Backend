import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/modules/auth/auth.service';

async function testForgotPassword() {
  console.log('Bootstrapping NestJS application...');
  const app = await NestFactory.createApplicationContext(AppModule);
  console.log('Application context bootstrapped.');

  const authService = app.get(AuthService);

  const testEmail = 'raj@sunrise.com';
  const testSubdomain = 'sunrise-realty';

  console.log(`Calling forgotPassword for ${testEmail} / ${testSubdomain}...`);
  try {
    const result = await authService.forgotPassword({
      email: testEmail,
      subdomain: testSubdomain,
    });
    console.log('Result:', result);
    
    console.log('Waiting 10 seconds to allow the queue worker to process...');
    await new Promise((resolve) => setTimeout(resolve, 10000));
  } catch (err) {
    console.error('Error during forgotPassword execution:', err);
  } finally {
    await app.close();
    console.log('Application context closed.');
  }
}

testForgotPassword();
