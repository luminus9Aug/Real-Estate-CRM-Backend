import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from '../src/app.module';

async function checkConfig() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const config = app.get(ConfigService);
  
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('jwt.secret:', config.get('jwt.secret') ? 'EXISTS' : 'MISSING');
  console.log('database.url:', config.get('database.url') ? 'EXISTS' : 'MISSING');
  
  await app.close();
}

checkConfig().catch(console.error);
