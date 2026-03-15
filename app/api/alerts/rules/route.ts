import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { alertRuleSchema, alertRuleUpdateSchema } from "@/lib/validators";

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

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as
    | {
        action: "UPDATE";
        ruleId: string;
        providerId?: string;
        type: "USAGE_THRESHOLD" | "SUBSCRIPTION_RENEWAL";
        threshold?: number;
        renewalLeadDays?: number;
        channels: Array<"IN_APP" | "EMAIL">;
        isEnabled: boolean;
      }
    | { action: "TOGGLE_ENABLED"; ruleId: string; isEnabled: boolean };

  const existing = await prisma.alertRule.findFirst({
    where: { id: body.ruleId, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Alert rule not found" }, { status: 404 });
  }

  if (body.action === "TOGGLE_ENABLED") {
    const updated = await prisma.alertRule.update({
      where: { id: existing.id },
      data: { isEnabled: body.isEnabled },
    });

    await writeAuditLog({
      userId: session.user.id,
      action: body.isEnabled ? "ALERT_RULE_ENABLE" : "ALERT_RULE_DISABLE",
      resource: "AlertRule",
      resourceId: updated.id,
      outcome: "SUCCESS",
    });

    return NextResponse.json(updated);
  }

  const parsed = alertRuleUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await prisma.alertRule.update({
    where: { id: existing.id },
    data: {
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
    action: "ALERT_RULE_UPDATE",
    resource: "AlertRule",
    resourceId: updated.id,
    outcome: "SUCCESS",
  });

  return NextResponse.json(updated);
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { ruleId?: string };
  if (!body.ruleId) {
    return NextResponse.json({ error: "ruleId is required" }, { status: 400 });
  }

  const existing = await prisma.alertRule.findFirst({
    where: { id: body.ruleId, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Alert rule not found" }, { status: 404 });
  }

  await prisma.alertRule.delete({
    where: { id: existing.id },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "ALERT_RULE_DELETE",
    resource: "AlertRule",
    resourceId: existing.id,
    outcome: "SUCCESS",
  });

  return NextResponse.json({ id: existing.id, deleted: true });
}
