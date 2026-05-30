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
import { UserRole, CommissionStatus } from '@prisma/client';

const run = process.env.RUN_E2E === '1';

(run ? describe : describe.skip)('Commissions (e2e)', () => {
  let app: INestApplication;
  let postgres: StartedPostgreSqlContainer;
  let redis: StartedRedisContainer;
  let prisma: PrismaService;
  let ownerCookie: string[];
  let managerCookie: string[];
  let agentCookie: string[];
  let tenantId: string;

  beforeAll(async () => {
    postgres = await new PostgreSqlContainer('postgres:15-alpine').start();
    redis = await new RedisContainer('redis:7-alpine').start();

    process.env.DATABASE_URL = postgres.getConnectionUri();
    process.env.REDIS_URL = redis.getConnectionUrl();
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    process.env.WS_SECRET = 'test-ws-secret';

    execSync('npx prisma migrate deploy', { env: process.env });
    
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

    // Setup Tenant and Users
    const signupRes = await request(app.getHttpServer())
      .post('/api/v1/auth/signup')
      .send({
        tenantName: 'Comm Tenant',
        subdomain: 'comm',
        ownerEmail: 'owner@test.com',
        ownerName: 'Owner',
        password: 'Password123!',
      });
    ownerCookie = signupRes.header['set-cookie'] as unknown as string[];
    tenantId = (await prisma.tenant.findUnique({where:{subdomain:'comm'}}))!.id;

    // Create Manager
    const pass = await require('bcryptjs').hash('Password123!', 12);
    await prisma.user.create({
      data: { tenantId, email: 'mgr@test.com', name: 'Mgr', role: UserRole.MANAGER, passwordHash: pass }
    });
    const loginMgr = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ subdomain: 'comm', email: 'mgr@test.com', password: 'Password123!' });
    managerCookie = loginMgr.header['set-cookie'] as unknown as string[];

    // Create Agent
    await prisma.user.create({
      data: { tenantId, email: 'agt@test.com', name: 'Agt', role: UserRole.AGENT, passwordHash: pass }
    });
    const loginAgt = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ subdomain: 'comm', email: 'agt@test.com', password: 'Password123!' });
    agentCookie = loginAgt.header['set-cookie'] as unknown as string[];
  }, 120000);

  afterAll(async () => {
    await app.close();
    await postgres.stop();
    await redis.stop();
  });

  async function createPendingCommission() {
    const user = await prisma.user.findFirst({ where: { tenantId, email: 'agt@test.com' } });
    const lead = await prisma.lead.create({
      data: { tenantId, name: 'Lead', phone: '123', createdById: user!.id }
    });
    return prisma.commissionTransaction.create({
      data: {
        tenantId,
        leadId: lead.id,
        agentId: user!.id,
        createdById: user!.id,
        amount: 1000,
        status: CommissionStatus.PENDING,
      }
    });
  }

  it('only OWNER can pay commission (403 for AGENT/MANAGER)', async () => {
    const comm = await createPendingCommission();

    const resAgt = await request(app.getHttpServer())
      .post(`/api/v1/commission/${comm.id}/pay`)
      .set('Cookie', agentCookie)
      .send({ paymentReference: 'REF1' });
    expect(resAgt.status).toBe(403);

    const resMgr = await request(app.getHttpServer())
      .post(`/api/v1/commission/${comm.id}/pay`)
      .set('Cookie', managerCookie)
      .send({ paymentReference: 'REF1' });
    expect(resMgr.status).toBe(403);

    const resOwner = await request(app.getHttpServer())
      .post(`/api/v1/commission/${comm.id}/pay`)
      .set('Cookie', ownerCookie)
      .send({ paymentReference: 'REF1' });
    expect(resOwner.status).toBe(201);
  });

  it('cannot pay commission that is already paid (409/400)', async () => {
    const comm = await createPendingCommission();
    
    // Pay first time
    await request(app.getHttpServer())
      .post(`/api/v1/commission/${comm.id}/pay`)
      .set('Cookie', ownerCookie)
      .send({ paymentReference: 'REF2' });

    // Pay second time
    const res = await request(app.getHttpServer())
      .post(`/api/v1/commission/${comm.id}/pay`)
      .set('Cookie', ownerCookie)
      .send({ paymentReference: 'REF3' });

    expect(res.status).toBe(400); // Per Rule 9.3: "Commission not found, already paid, or being processed"
  });

  it('concurrent pay commission requests — only one succeeds', async () => {
    const comm = await createPendingCommission();

    const results = await Promise.all([
      request(app.getHttpServer()).post(`/api/v1/commission/${comm.id}/pay`).set('Cookie', ownerCookie).send({ paymentReference: 'CONC1' }),
      request(app.getHttpServer()).post(`/api/v1/commission/${comm.id}/pay`).set('Cookie', ownerCookie).send({ paymentReference: 'CONC2' }),
      request(app.getHttpServer()).post(`/api/v1/commission/${comm.id}/pay`).set('Cookie', ownerCookie).send({ paymentReference: 'CONC3' }),
    ]);

    const successes = results.filter(r => r.status === 201);
    const failures = results.filter(r => r.status === 400);

    expect(successes).toHaveLength(1);
    expect(failures.length).toBeGreaterThanOrEqual(1);
  });
});
