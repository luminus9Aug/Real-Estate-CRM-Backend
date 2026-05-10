import { PrismaClient, LeadSource, LeadStatus, SupportedLanguage, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 12;

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash('OwnerPass123!', BCRYPT_ROUNDS);

  const tenant = await prisma.tenant.upsert({
    where: { subdomain: 'demo' },
    create: {
      name: 'Demo Realty',
      subdomain: 'demo',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      defaultLanguage: SupportedLanguage.en,
      supportedLanguages: [SupportedLanguage.en, SupportedLanguage.hi],
    },
    update: {},
  });

  const owner = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'owner@demo.local' } },
    create: {
      tenantId: tenant.id,
      email: 'owner@demo.local',
      name: 'Demo Owner',
      role: UserRole.OWNER,
      passwordHash,
      language: SupportedLanguage.en,
      commissionRate: 2.5,
    },
    update: { passwordHash },
  });

  const leadData = [
    { name: 'Lead One', phone: '+919800000001', status: LeadStatus.HOT, source: LeadSource.WHATSAPP },
    { name: 'Lead Two', phone: '+919800000002', status: LeadStatus.WARM, source: LeadSource.WALKIN },
    { name: 'Lead Three', phone: '+919800000003', status: LeadStatus.COLD, source: LeadSource.OTHER },
    { name: 'Lead Four', phone: '+919800000004', status: LeadStatus.HOT, source: LeadSource.GOOGLE },
    { name: 'Lead Five', phone: '+919800000005', status: LeadStatus.WARM, source: LeadSource.FACEBOOK },
  ];

  for (const l of leadData) {
    await prisma.lead.create({
      data: {
        tenantId: tenant.id,
        createdById: owner.id,
        name: l.name,
        phone: l.phone,
        status: l.status,
        source: l.source,
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e: unknown) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
