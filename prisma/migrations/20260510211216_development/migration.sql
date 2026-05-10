-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('HOT', 'WARM', 'COLD', 'LOST', 'CONVERTED');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('WHATSAPP', 'WALKIN', 'REFERENCE', 'FACEBOOK', 'GOOGLE', 'NINETY_NINE_ACRES', 'MAGICBRICKS', 'HOUSING', 'OTHER');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('PLOT', 'APARTMENT', 'COMMERCIAL', 'VILLA');

-- CreateEnum
CREATE TYPE "PropertyStatus" AS ENUM ('AVAILABLE', 'SOLD', 'HELD', 'BOOKED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'MANAGER', 'AGENT', 'VIEWER');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('CALL', 'VISIT', 'NOTE', 'EMAIL', 'WHATSAPP', 'MEETING');

-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "CommissionType" AS ENUM ('PERCENT', 'FIXED');

-- CreateEnum
CREATE TYPE "SupportedLanguage" AS ENUM ('en', 'hi', 'ar');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "subdomain" VARCHAR(100) NOT NULL,
    "logo_url" TEXT,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
    "phone" VARCHAR(20),
    "email" VARCHAR(200),
    "address" TEXT,
    "default_language" "SupportedLanguage" NOT NULL DEFAULT 'en',
    "supported_languages" "SupportedLanguage"[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "email" VARCHAR(200) NOT NULL,
    "phone" VARCHAR(20),
    "name" VARCHAR(100) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'AGENT',
    "password_hash" TEXT NOT NULL,
    "avatar_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "birthday" TIMESTAMP(3),
    "anniversary" TIMESTAMP(3),
    "language" "SupportedLanguage" NOT NULL DEFAULT 'en',
    "commission_rate" DECIMAL(5,2) DEFAULT 0,
    "commission_type" "CommissionType" NOT NULL DEFAULT 'PERCENT',
    "fixed_commission_amount" DECIMAL(12,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "assigned_to_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "preferred_property_id" TEXT,
    "closed_property_id" TEXT,
    "name" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "email" VARCHAR(200),
    "alternate_phone" VARCHAR(20),
    "budget_min" DECIMAL(12,2),
    "budget_max" DECIMAL(12,2),
    "message" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'HOT',
    "source" "LeadSource" NOT NULL DEFAULT 'OTHER',
    "custom_fields" JSONB,
    "next_follow_up_at" TIMESTAMP(3),
    "last_contacted_at" TIMESTAMP(3),
    "converted_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "lost_reason" VARCHAR(255),
    "preferred_language" "SupportedLanguage",
    "final_sale_value" DECIMAL(12,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "properties" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "type" "PropertyType" NOT NULL,
    "status" "PropertyStatus" NOT NULL DEFAULT 'AVAILABLE',
    "price" DECIMAL(12,2),
    "area_sq_ft" INTEGER,
    "bhk" INTEGER,
    "floor" VARCHAR(50),
    "location" VARCHAR(255) NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "images" TEXT[],
    "brochures" TEXT[],
    "features" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "sender_id" TEXT,
    "content" TEXT NOT NULL,
    "is_from_lead" BOOLEAN NOT NULL DEFAULT true,
    "delivered_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follow_ups" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "assigned_to_id" TEXT NOT NULL,
    "message" TEXT,
    "due_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_transactions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
    "status" "CommissionStatus" NOT NULL DEFAULT 'PENDING',
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMP(3),
    "payment_reference" VARCHAR(255),
    "notes" TEXT,
    "voided_at" TIMESTAMP(3),
    "void_reason" VARCHAR(255),

    CONSTRAINT "commission_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brochure_links" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "opened_count" INTEGER NOT NULL DEFAULT 0,
    "opened_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brochure_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_subdomain_key" ON "tenants"("subdomain");

-- CreateIndex
CREATE INDEX "tenants_subdomain_idx" ON "tenants"("subdomain");

-- CreateIndex
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");

-- CreateIndex
CREATE INDEX "users_tenant_id_role_idx" ON "users"("tenant_id", "role");

-- CreateIndex
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenant_id_email_key" ON "users"("tenant_id", "email");

-- CreateIndex
CREATE INDEX "leads_tenant_id_status_next_follow_up_at_idx" ON "leads"("tenant_id", "status", "next_follow_up_at");

-- CreateIndex
CREATE INDEX "leads_tenant_id_assigned_to_id_status_idx" ON "leads"("tenant_id", "assigned_to_id", "status");

-- CreateIndex
CREATE INDEX "leads_tenant_id_phone_idx" ON "leads"("tenant_id", "phone");

-- CreateIndex
CREATE INDEX "leads_tenant_id_created_at_idx" ON "leads"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "leads_deleted_at_idx" ON "leads"("deleted_at");

-- CreateIndex
CREATE INDEX "properties_tenant_id_status_type_idx" ON "properties"("tenant_id", "status", "type");

-- CreateIndex
CREATE INDEX "properties_tenant_id_price_idx" ON "properties"("tenant_id", "price");

-- CreateIndex
CREATE INDEX "properties_deleted_at_idx" ON "properties"("deleted_at");

-- CreateIndex
CREATE INDEX "messages_tenant_id_lead_id_created_at_idx" ON "messages"("tenant_id", "lead_id", "created_at");

-- CreateIndex
CREATE INDEX "activities_tenant_id_lead_id_created_at_idx" ON "activities"("tenant_id", "lead_id", "created_at");

-- CreateIndex
CREATE INDEX "follow_ups_tenant_id_due_at_completed_at_idx" ON "follow_ups"("tenant_id", "due_at", "completed_at");

-- CreateIndex
CREATE INDEX "follow_ups_tenant_id_assigned_to_id_completed_at_idx" ON "follow_ups"("tenant_id", "assigned_to_id", "completed_at");

-- CreateIndex
CREATE INDEX "commission_transactions_tenant_id_agent_id_status_idx" ON "commission_transactions"("tenant_id", "agent_id", "status");

-- CreateIndex
CREATE INDEX "commission_transactions_tenant_id_lead_id_idx" ON "commission_transactions"("tenant_id", "lead_id");

-- CreateIndex
CREATE INDEX "commission_transactions_tenant_id_calculated_at_idx" ON "commission_transactions"("tenant_id", "calculated_at");

-- CreateIndex
CREATE UNIQUE INDEX "brochure_links_token_key" ON "brochure_links"("token");

-- CreateIndex
CREATE INDEX "brochure_links_token_idx" ON "brochure_links"("token");

-- CreateIndex
CREATE INDEX "brochure_links_expires_at_idx" ON "brochure_links"("expires_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_preferred_property_id_fkey" FOREIGN KEY ("preferred_property_id") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_closed_property_id_fkey" FOREIGN KEY ("closed_property_id") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_transactions" ADD CONSTRAINT "commission_transactions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_transactions" ADD CONSTRAINT "commission_transactions_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_transactions" ADD CONSTRAINT "commission_transactions_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_transactions" ADD CONSTRAINT "commission_transactions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brochure_links" ADD CONSTRAINT "brochure_links_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brochure_links" ADD CONSTRAINT "brochure_links_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
