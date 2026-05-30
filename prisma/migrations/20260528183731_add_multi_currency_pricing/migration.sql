-- AlterTable
ALTER TABLE "plans" ADD COLUMN     "price_monthly_aed" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "price_monthly_inr" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "price_yearly_aed" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "price_yearly_inr" DECIMAL(10,2) NOT NULL DEFAULT 0;
