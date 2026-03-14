import { headers } from "next/headers";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";

type AuditInput = {
  userId?: string | null;
  action: string;
  resource: string;
  resourceId?: string;
  outcome: "SUCCESS" | "DENIED" | "ERROR";
  metadata?: Prisma.InputJsonValue;
};

export async function writeAuditLog(input: AuditInput) {
  const h = await headers();

  return prisma.auditLog.create({
    data: {
      userId: input.userId || null,
      action: input.action,
      resource: input.resource,
      resourceId: input.resourceId,
      outcome: input.outcome,
      ipAddress: h.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      userAgent: h.get("user-agent"),
      metadata: input.metadata,
    },
  });
}
