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
import { LeadStatus, PropertyStatus, UserRole, CommissionStatus } from '@prisma/client';

const run = process.env.RUN_E2E === '1';

(run ? describe : describe.skip)('Leads (e2e)', () => {
  let app: INestApplication;
  let postgres: StartedPostgreSqlContainer;
  let redis: StartedRedisContainer;
  let prisma: PrismaService;
  let ownerCookie: string[];
  let agentCookie: string[];
  let tenantId: string;
  let ownerId: string;
  let agentId: string;

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
        tenantName: 'Test Tenant',
        subdomain: 'test',
        ownerEmail: 'owner@test.com',
        ownerName: 'Owner',
        password: 'Password123!',
      });
    ownerCookie = signupRes.header['set-cookie'] as unknown as string[];
    
    const owner = await prisma.user.findUnique({ where: { tenantId_email: { tenantId: (await prisma.tenant.findUnique({where:{subdomain:'test'}}))!.id, email: 'owner@test.com' } } });
    tenantId = owner!.tenantId;
    ownerId = owner!.id;

    // Create an Agent
    const agentPassword = await require('bcryptjs').hash('Password123!', 12);
    const agent = await prisma.user.create({
      data: {
        tenantId,
        email: 'agent@test.com',
        name: 'Agent',
        role: UserRole.AGENT,
        passwordHash: agentPassword,
        commissionRate: 2.5,
      }
    });
    agentId = agent.id;

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ subdomain: 'test', email: 'agent@test.com', password: 'Password123!' });
    agentCookie = loginRes.header['set-cookie'] as unknown as string[];
  }, 120000);

  afterAll(async () => {
    await app.close();
    await postgres.stop();
    await redis.stop();
  });

  it('cannot close lead with no assigned agent', async () => {
    const property = await prisma.property.create({
      data: { tenantId, title: 'Prop 1', type: 'APARTMENT', status: 'AVAILABLE', location: 'Test' }
    });

    const leadRes = await request(app.getHttpServer())
      .post('/api/v1/leads')
      .set('Cookie', ownerCookie)
      .send({ name: 'Unassigned Lead', phone: '1234567890', source: 'WALKIN' });
    
    const leadId = leadRes.body.data.id;

    const res = await request(app.getHttpServer())
      .post(`/api/v1/leads/${leadId}/close`)
      .set('Cookie', ownerCookie)
      .send({ closedPropertyId: property.id, finalSaleValue: 1000000 });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('agent');
  });

  it('closing lead creates CommissionTransaction and updates property status', async () => {
    const property = await prisma.property.create({
      data: { tenantId, title: 'Prop 2', type: 'VILLA', status: 'AVAILABLE', location: 'Test' }
    });

    const leadRes = await request(app.getHttpServer())
      .post('/api/v1/leads')
      .set('Cookie', ownerCookie)
      .send({ name: 'Assigned Lead', phone: '0987654321', source: 'FACEBOOK' });
    
    const leadId = leadRes.body.data.id;

    // Assign to agent
    await request(app.getHttpServer())
      .post(`/api/v1/leads/${leadId}/assign`)
      .set('Cookie', ownerCookie)
      .send({ agentId });

    const res = await request(app.getHttpServer())
      .post(`/api/v1/leads/${leadId}/close`)
      .set('Cookie', ownerCookie)
      .send({ closedPropertyId: property.id, finalSaleValue: 2000000 });

    expect(res.status).toBe(201);
    
    // Verify lead status
    const updatedLead = await prisma.lead.findUnique({ where: { id: leadId } });
    expect(updatedLead?.status).toBe(LeadStatus.CONVERTED);

    // Verify property status
    const updatedProp = await prisma.property.findUnique({ where: { id: property.id } });
    expect(updatedProp?.status).toBe(PropertyStatus.SOLD);

    // Verify commission
    const commission = await prisma.commissionTransaction.findFirst({ where: { leadId } });
    expect(commission?.status).toBe(CommissionStatus.PENDING);
    expect(Number(commission?.amount)).toBe(50000); // 2.5% of 2M
  });

  it('AGENT cannot close a lead (403)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/leads/some-id/close')
      .set('Cookie', agentCookie)
      .send({ closedPropertyId: 'some-id', finalSaleValue: 1000000 });

    expect(res.status).toBe(403);
  });

  it('cannot close already-converted lead', async () => {
    // Re-use leadId from previous test which is now CONVERTED
    const lead = await prisma.lead.findFirst({ where: { status: LeadStatus.CONVERTED } });
    
    const res = await request(app.getHttpServer())
      .post(`/api/v1/leads/${lead?.id}/close`)
      .set('Cookie', ownerCookie)
      .send({ closedPropertyId: 'some-id', finalSaleValue: 1000000 });

    expect(res.status).toBe(404); // Or 400 depending on implementation "Lead not found or already converted"
  });
});
