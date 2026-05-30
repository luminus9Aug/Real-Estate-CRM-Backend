-- AlterTable
ALTER TABLE "plans" ADD COLUMN     "aed_multiplier" DECIMAL(10,6) NOT NULL DEFAULT 0.05,
ADD COLUMN     "base_price_monthly" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "yearly_discount_pct" DECIMAL(5,2) NOT NULL DEFAULT 20;
