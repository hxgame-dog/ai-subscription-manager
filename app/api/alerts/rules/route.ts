import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { alertRuleSchema } from "@/lib/validators";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rules = await prisma.alertRule.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(rules);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = alertRuleSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const rule = await prisma.alertRule.create({
    data: {
      userId: session.user.id,
      providerId: parsed.data.providerId,
      type: parsed.data.type,
      threshold: parsed.data.threshold,
      renewalLeadDays: parsed.data.renewalLeadDays,
      channels: parsed.data.channels,
      isEnabled: parsed.data.isEnabled,
    },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "ALERT_RULE_CREATE",
    resource: "AlertRule",
    resourceId: rule.id,
    outcome: "SUCCESS",
  });

  return NextResponse.json(rule, { status: 201 });
}
