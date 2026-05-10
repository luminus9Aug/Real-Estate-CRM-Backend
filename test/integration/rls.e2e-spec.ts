import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';

const run = process.env.RUN_E2E === '1';

(run ? describe : describe.skip)('RLS (e2e)', () => {
  let app: INestApplication;
  let postgres: StartedPostgreSqlContainer;
  let redis: StartedRedisContainer;
  let prisma: PrismaService;

  beforeAll(async () => {
    postgres = await new PostgreSqlContainer('postgres:15-alpine').start();
    redis = await new RedisContainer('redis:7-alpine').start();

    const dbUrl = postgres.getConnectionUri();
    process.env.DATABASE_URL = dbUrl;
    process.env.REDIS_URL = redis.getConnectionUrl();
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    process.env.WS_SECRET = 'test-ws-secret';

    // Run migrations
    execSync('npx prisma migrate deploy', { env: process.env });
    
    // Create Prisma service to apply RLS
    const tempPrisma = new PrismaService();
    const sql = fs.readFileSync(path.join(__dirname, '../../scripts/apply-rls.sql'), 'utf8');
    await tempPrisma.$executeRawUnsafe(sql);
    await tempPrisma.$disconnect();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    prisma = app.get(PrismaService);
    await app.init();
  }, 120000);

  afterAll(async () => {
    await app.close();
    await postgres.stop();
    await redis.stop();
  });

  async function signupTenant(subdomain: string, email: string) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/signup')
      .send({
        tenantName: `${subdomain} Corp`,
        subdomain,
        ownerEmail: email,
        ownerName: subdomain,
        password: 'Password123!',
      });
    return res.header['set-cookie'];
  }

  it('tenant A cannot read tenant B leads', async () => {
    const cookieA = await signupTenant('tenant-a', 'a@test.com');
    const cookieB = await signupTenant('tenant-b', 'b@test.com');

    // Tenant B creates a lead
    await request(app.getHttpServer())
      .post('/api/v1/leads')
      .set('Cookie', cookieB)
      .send({
        name: 'Lead B',
        phone: '9999999999',
        source: 'WHATSAPP',
      });

    // Tenant A tries to list leads
    const res = await request(app.getHttpServer())
      .get('/api/v1/leads')
      .set('Cookie', cookieA);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(0); // RLS filtered it out
  });

  it('tenant A cannot update tenant B lead', async () => {
    const cookieB = await signupTenant('tenant-b-2', 'b2@test.com');
    const cookieA = await signupTenant('tenant-a-2', 'a2@test.com');

    // Tenant B creates a lead
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/leads')
      .set('Cookie', cookieB)
      .send({
        name: 'Lead B',
        phone: '8888888888',
        source: 'WHATSAPP',
      });
    
    const leadId = createRes.body.data.id;

    // Tenant A tries to update Tenant B's lead
    const updateRes = await request(app.getHttpServer())
      .patch(`/api/v1/leads/${leadId}`)
      .set('Cookie', cookieA)
      .send({ name: 'Hacked' });

    expect(updateRes.status).toBe(404); // RLS makes it look non-existent
  });

  it('tenant A cannot create lead with tenant B tenantId', async () => {
    const cookieA = await signupTenant('tenant-a-3', 'a3@test.com');
    
    // Find Tenant B's ID (dirty way for test)
    const tenantB = await prisma.tenant.findUnique({ where: { subdomain: 'tenant-b' } });

    // Tenant A tries to create a lead with Tenant B's tenantId
    const res = await request(app.getHttpServer())
      .post('/api/v1/leads')
      .set('Cookie', cookieA)
      .send({
        name: 'Malicious',
        phone: '7777777777',
        source: 'WHATSAPP',
        tenantId: tenantB?.id, // Trying to inject B's ID
      });

    // Even if they try to inject it, the controller/service should use req.user.tenantId
    // and RLS WITH CHECK will block it if the code tries to save B's ID.
    // In our app, the service ignores tenantId from DTO and uses req.user.tenantId.
    // But let's verify it ended up in Tenant A's silo.
    
    expect(res.status).toBe(201);
    expect(res.body.data.tenantId).not.toBe(tenantB?.id);
  });
});
