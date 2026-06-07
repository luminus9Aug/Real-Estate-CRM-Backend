import { PrismaClient } from '@prisma/client';

async function listUsers() {
  const prisma = new PrismaClient();
  try {
    const tenants = await prisma.tenant.findMany();
    console.log('Tenants:', tenants);

    const users = await prisma.user.findMany();
    console.log('Users:', users.map(u => ({ id: u.id, email: u.email, tenantId: u.tenantId, role: u.role, isActive: u.isActive, deletedAt: u.deletedAt })));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

listUsers();
