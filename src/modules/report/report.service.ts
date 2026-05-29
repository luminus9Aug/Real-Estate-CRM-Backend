import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ReportService {
  constructor(private readonly prisma: PrismaService) {}

  async teamCommission(tenantId: string): Promise<Array<Record<string, unknown>>> {
    return this.prisma.$queryRaw<
      Array<{
        agentId: string;
        status: string;
        sumAmount: unknown;
        count: number;
      }>
    >`
      SELECT
        agent_id AS "agentId",
        status::text AS "status",
        COALESCE(SUM(amount), 0) AS "sumAmount",
        COUNT(*)::int AS "count"
      FROM commission_transactions
      WHERE tenant_id = ${tenantId} AND voided_at IS NULL
      GROUP BY agent_id, status
      ORDER BY agent_id ASC, status ASC
    `;
  }

  async agentPerformance(tenantId: string): Promise<Array<Record<string, unknown>>> {
    return this.prisma.$queryRaw<
      Array<{
        assignedToId: string | null;
        status: string;
        count: number;
      }>
    >`
      SELECT
        assigned_to_id AS "assignedToId",
        status::text AS "status",
        COUNT(*)::int AS "count"
      FROM leads
      WHERE tenant_id = ${tenantId} AND deleted_at IS NULL
      GROUP BY assigned_to_id, status
      ORDER BY assigned_to_id ASC NULLS LAST, status ASC
    `;
  }
}
