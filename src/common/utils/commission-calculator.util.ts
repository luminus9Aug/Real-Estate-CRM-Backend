import { BadRequestException } from '@nestjs/common';
import { CommissionType, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export type AgentForCommission = {
  id: string;
  commissionType: CommissionType;
  commissionRate: Prisma.Decimal | null;
  fixedCommissionAmount: Prisma.Decimal | null;
};

export function calculateCommission(agent: AgentForCommission, saleValue: number): Decimal {
  if (saleValue <= 0) {
    throw new BadRequestException('Sale value must be a positive number');
  }
  if (agent.commissionType === CommissionType.PERCENT) {
    if (agent.commissionRate === null || agent.commissionRate === undefined) {
      throw new BadRequestException(`Commission rate not configured for agent ${agent.id}`);
    }
    const rate = new Decimal(agent.commissionRate.toString());
    if (rate.lessThan(0) || rate.greaterThan(100)) {
      throw new BadRequestException(`Commission rate ${rate.toString()} is out of valid range (0–100)`);
    }
    return new Decimal(saleValue).mul(rate).div(100).toDecimalPlaces(2);
  }
  if (agent.commissionType === CommissionType.FIXED) {
    if (!agent.fixedCommissionAmount) {
      throw new BadRequestException(`Fixed commission amount not set for agent ${agent.id}`);
    }
    return new Decimal(agent.fixedCommissionAmount.toString());
  }
  throw new BadRequestException('Unknown commission type');
}
