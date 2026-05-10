import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('Applying RLS policies...');
  const sql = fs.readFileSync(path.join(__dirname, 'apply-rls.sql'), 'utf8');
  
  // Split by DO $$ blocks if needed, but since it's one block, we can run it.
  try {
    await prisma.$executeRawUnsafe(sql);
    console.log('RLS policies applied successfully.');
  } catch (error) {
    console.error('Error applying RLS policies:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
