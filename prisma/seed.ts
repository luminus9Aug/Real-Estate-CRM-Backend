import { PrismaClient, LeadSource, LeadStatus, SupportedLanguage, UserRole, SubscriptionStatus, PlanInterval, FeatureType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const FeatureKey = {
  MAX_AGENTS: 'MAX_AGENTS',
  MAX_LEADS_PER_MONTH: 'MAX_LEADS_PER_MONTH',
  MAX_PROPERTIES: 'MAX_PROPERTIES',
  WHATSAPP_INTEGRATION: 'WHATSAPP_INTEGRATION',
  ADVANCED_REPORTS: 'ADVANCED_REPORTS',
  API_ACCESS: 'API_ACCESS',
  CUSTOM_BRANDING: 'CUSTOM_BRANDING',
} as const;

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 12;

async function createSuperAdmin() {
  const existingSuperAdmin = await prisma.user.findFirst({
    where: { role: UserRole.SUPER_ADMIN },
  });

  if (existingSuperAdmin) {
    console.log('✅ SuperAdmin already exists:', existingSuperAdmin.email);
    return existingSuperAdmin;
  }

  const passwordHash = await bcrypt.hash('SuperAdmin@2026!Secure', BCRYPT_ROUNDS);

  const superAdmin = await prisma.user.create({
    data: {
      email: 'admin@propertysales.com',
      name: 'Super Administrator',
      role: UserRole.SUPER_ADMIN,
      passwordHash,
      isActive: true,
      isSuperAdmin: true,
      tenantId: null,
      language: SupportedLanguage.en,
    },
  });

  console.log('✅ SuperAdmin created:', superAdmin.email);
  console.log('🔑 Login with: admin@propertysales.com / SuperAdmin@2026!Secure');
  return superAdmin;
}

/**
 * Computes all 4 currency price columns from 3 admin-controlled pricing rule inputs.
 *
 * Formula (mirrors AdminService.computePricingColumns):
 *   INR monthly  = basePriceMonthly
 *   INR yearly   = floor(base * 12 * discountFactor)
 *   AED monthly  = floor(base * aedMultiplier)
 *   AED yearly   = floor(aedMonthly * 12 * discountFactor)
 *
 * aedMultiplier default = 0.05  →  1 AED ≈ 20 INR, yielding 99 AED for 1999 INR
 * yearlyDiscountPct default = 20  →  20% off yearly billing
 */
function computePricing(
  basePriceMonthly: number,
  aedMultiplier = 0.05,
  yearlyDiscountPct = 20,
) {
  const discountFactor = (100 - yearlyDiscountPct) / 100;
  const priceMonthlyINR = basePriceMonthly;
  const priceYearlyINR = Math.floor(basePriceMonthly * 12 * discountFactor);
  const priceMonthlyAED = Math.floor(basePriceMonthly * aedMultiplier);
  const priceYearlyAED = Math.floor(priceMonthlyAED * 12 * discountFactor);

  return {
    basePriceMonthly,
    aedMultiplier,
    yearlyDiscountPct,
    priceMonthly: priceMonthlyINR,
    priceYearly: priceYearlyINR,
    priceMonthlyINR,
    priceYearlyINR,
    priceMonthlyAED,
    priceYearlyAED,
  };
}

async function createDefaultPlans() {
  /**
   * Plans use 3 source-of-truth pricing fields:
   *   basePriceMonthly  — INR monthly price (the admin sets this)
   *   aedMultiplier     — how to convert INR → AED (floor(base * mult))
   *                       0.05 = 1 AED per 20 INR (standard)
   *   yearlyDiscountPct — % saved when paying annually (default 20%)
   *
   * All other currency columns are derived automatically.
   */
  const plans = [
    {
      name: 'free',
      displayName: { en: 'Free Plan', hi: 'मुफ्त प्लान', ar: 'الخطة المجانية' },
      basePriceMonthly: 0,
      aedMultiplier: 0.05,
      yearlyDiscountPct: 20,
      trialDays: 0,
      sortOrder: 1,
      features: [
        { featureKey: FeatureKey.MAX_AGENTS, type: FeatureType.QUOTA, limit: 2, isEnabled: true },
        { featureKey: FeatureKey.MAX_LEADS_PER_MONTH, type: FeatureType.QUOTA, limit: 25, isEnabled: true },
        { featureKey: FeatureKey.MAX_PROPERTIES, type: FeatureType.QUOTA, limit: 10, isEnabled: true },
        { featureKey: FeatureKey.WHATSAPP_INTEGRATION, type: FeatureType.BOOLEAN, limit: null, isEnabled: false },
        { featureKey: FeatureKey.ADVANCED_REPORTS, type: FeatureType.BOOLEAN, limit: null, isEnabled: false },
      ],
    },
    {
      name: 'starter',
      displayName: { en: 'Starter Plan', hi: 'स्टार्टर प्लान', ar: 'خطة المبتدئين' },
      // 1999 INR/mo → floor(1999 * 0.05) = 99 AED/mo
      // Yearly: floor(1999 * 12 * 0.8) = 19190 INR | floor(99 * 12 * 0.8) = 950 AED
      basePriceMonthly: 1999,
      aedMultiplier: 0.05,
      yearlyDiscountPct: 20,
      trialDays: 14,
      sortOrder: 2,
      features: [
        { featureKey: FeatureKey.MAX_AGENTS, type: FeatureType.QUOTA, limit: 5, isEnabled: true },
        { featureKey: FeatureKey.MAX_LEADS_PER_MONTH, type: FeatureType.QUOTA, limit: 200, isEnabled: true },
        { featureKey: FeatureKey.MAX_PROPERTIES, type: FeatureType.QUOTA, limit: 100, isEnabled: true },
        { featureKey: FeatureKey.WHATSAPP_INTEGRATION, type: FeatureType.BOOLEAN, limit: null, isEnabled: true },
        { featureKey: FeatureKey.ADVANCED_REPORTS, type: FeatureType.BOOLEAN, limit: null, isEnabled: false },
      ],
    },
    {
      name: 'pro',
      displayName: { en: 'Pro Plan', hi: 'प्रो प्लान', ar: 'الخطة الاحترافية' },
      // 5999 INR/mo → floor(5999 * 0.05) = 299 AED/mo
      // Yearly: floor(5999 * 12 * 0.8) = 57590 INR | floor(299 * 12 * 0.8) = 2870 AED
      basePriceMonthly: 5999,
      aedMultiplier: 0.05,
      yearlyDiscountPct: 20,
      trialDays: 14,
      sortOrder: 3,
      features: [
        { featureKey: FeatureKey.MAX_AGENTS, type: FeatureType.QUOTA, limit: 15, isEnabled: true },
        { featureKey: FeatureKey.MAX_LEADS_PER_MONTH, type: FeatureType.QUOTA, limit: 1000, isEnabled: true },
        { featureKey: FeatureKey.MAX_PROPERTIES, type: FeatureType.QUOTA, limit: 500, isEnabled: true },
        { featureKey: FeatureKey.WHATSAPP_INTEGRATION, type: FeatureType.BOOLEAN, limit: null, isEnabled: true },
        { featureKey: FeatureKey.ADVANCED_REPORTS, type: FeatureType.BOOLEAN, limit: null, isEnabled: true },
        { featureKey: FeatureKey.CUSTOM_BRANDING, type: FeatureType.BOOLEAN, limit: null, isEnabled: true },
        { featureKey: FeatureKey.API_ACCESS, type: FeatureType.BOOLEAN, limit: null, isEnabled: true },
      ],
    },
  ];

  for (const p of plans) {
    const pricing = computePricing(p.basePriceMonthly, p.aedMultiplier, p.yearlyDiscountPct);
    const existingPlan = await prisma.plan.findFirst({ where: { name: p.name } });

    if (existingPlan) {
      // Idempotent update — recomputes and persists all pricing columns
      await prisma.plan.update({
        where: { id: existingPlan.id },
        data: {
          displayName: p.displayName,
          trialDays: p.trialDays,
          sortOrder: p.sortOrder,
          ...pricing,
        },
      });
      console.log(
        `✅ Plan "${p.name}" updated — INR: ${pricing.priceMonthlyINR}/mo, AED: ${pricing.priceMonthlyAED}/mo`,
      );
    } else {
      await prisma.plan.create({
        data: {
          name: p.name,
          displayName: p.displayName,
          trialDays: p.trialDays,
          sortOrder: p.sortOrder,
          ...pricing,
          features: { create: p.features },
        },
      });
      console.log(
        `✅ Plan "${p.name}" created — INR: ${pricing.priceMonthlyINR}/mo, AED: ${pricing.priceMonthlyAED}/mo`,
      );
    }
  }
}

async function main(): Promise<void> {
  console.log('🌱 Seeding database...');

  await createSuperAdmin();
  await createDefaultPlans();

  const passwordHash = await bcrypt.hash('OwnerPass123!', BCRYPT_ROUNDS);

  const freePlan = await prisma.plan.findFirst({ where: { name: 'free' } });

  const tenant = await prisma.tenant.upsert({
    where: { subdomain: 'demo' },
    create: {
      name: 'Demo Realty',
      subdomain: 'demo',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      defaultLanguage: SupportedLanguage.en,
      supportedLanguages: [SupportedLanguage.en, SupportedLanguage.hi],
      currentPlanId: freePlan?.id,
      subscriptionStatus: SubscriptionStatus.TRIAL,
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
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

  // Check if leads exist before creating
  const leadCount = await prisma.lead.count({ where: { tenantId: tenant.id } });
  if (leadCount === 0) {
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

  console.log('✅ Seeding complete');
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
