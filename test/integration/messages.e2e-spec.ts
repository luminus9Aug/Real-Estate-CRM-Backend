import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from '../../src/app.module';

const run = process.env.RUN_E2E === '1';

(run ? describe : describe.skip)('Messages (e2e)', () => {
  let app: INestApplication;
  let postgres: StartedPostgreSqlContainer;
  let redis: StartedRedisContainer;

  beforeAll(async () => {
    postgres = await new PostgreSqlContainer('postgres:15-alpine').start();
    redis = await new RedisContainer('redis:7-alpine').start();

    process.env.DATABASE_URL = postgres.getConnectionUri();
    process.env.REDIS_URL = redis.getConnectionUrl();
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    process.env.WS_SECRET = 'test-ws-secret';
    process.env.TWILIO_AUTH_TOKEN = 'test-token';
    process.env.TWILIO_WEBHOOK_URL = 'http://localhost:3001/api/v1/messages/webhook/whatsapp';

    execSync('npx prisma migrate deploy', { env: process.env });

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  }, 120000);

  afterAll(async () => {
    await app.close();
    await postgres.stop();
    await redis.stop();
  });

  it('POST /messages/webhook/whatsapp returns 403 with invalid Twilio signature', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/messages/webhook/whatsapp')
      .set('x-twilio-signature', 'invalid-signature')
      .send({ Body: 'Hello', From: 'whatsapp:+1234567890' });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('signature');
  });

  it('POST /messages/webhook/whatsapp returns 403 when signature is missing', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/messages/webhook/whatsapp')
      .send({ Body: 'Hello' });

    expect(res.status).toBe(403);
  });
});
