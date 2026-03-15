import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { subscriptionSchema, subscriptionUpdateSchema } from "@/lib/validators";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await prisma.subscription.findMany({
    where: { userId: session.user.id },
    include: { provider: true },
    orderBy: { renewalDate: "asc" },
  });

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = subscriptionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const sub = await prisma.subscription.create({
    data: {
      userId: session.user.id,
      providerId: parsed.data.providerId,
      planName: parsed.data.planName,
      billingCycle: parsed.data.billingCycle,
      price: new Prisma.Decimal(parsed.data.price),
      currency: parsed.data.currency.toUpperCase(),
      renewalDate: new Date(parsed.data.renewalDate),
      paymentMethod: parsed.data.paymentMethod,
      notes: parsed.data.notes,
    },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "SUBSCRIPTION_CREATE",
    resource: "Subscription",
    resourceId: sub.id,
    outcome: "SUCCESS",
  });

  return NextResponse.json(sub, { status: 201 });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as
    | {
        action: "UPDATE";
        subscriptionId: string;
        providerId: string;
        planName: string;
        billingCycle: "MONTHLY" | "YEARLY" | "CUSTOM";
        price: number;
        currency: string;
        renewalDate: string;
        paymentMethod?: string;
        notes?: string;
      }
    | { action: "TOGGLE_ACTIVE"; subscriptionId: string; isActive: boolean };

  const existing = await prisma.subscription.findFirst({
    where: { id: body.subscriptionId, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
  }

  if (body.action === "TOGGLE_ACTIVE") {
    const updated = await prisma.subscription.update({
      where: { id: existing.id },
      data: { isActive: body.isActive },
    });

    await writeAuditLog({
      userId: session.user.id,
      action: body.isActive ? "SUBSCRIPTION_ENABLE" : "SUBSCRIPTION_DISABLE",
      resource: "Subscription",
      resourceId: updated.id,
      outcome: "SUCCESS",
    });

    return NextResponse.json(updated);
  }

  const parsed = subscriptionUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await prisma.subscription.update({
    where: { id: existing.id },
    data: {
      providerId: parsed.data.providerId,
      planName: parsed.data.planName,
      billingCycle: parsed.data.billingCycle,
      price: new Prisma.Decimal(parsed.data.price),
      currency: parsed.data.currency.toUpperCase(),
      renewalDate: new Date(parsed.data.renewalDate),
      paymentMethod: parsed.data.paymentMethod,
      notes: parsed.data.notes,
    },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "SUBSCRIPTION_UPDATE",
    resource: "Subscription",
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

  const body = (await request.json()) as { subscriptionId?: string };
  if (!body.subscriptionId) {
    return NextResponse.json({ error: "subscriptionId is required" }, { status: 400 });
  }

  const existing = await prisma.subscription.findFirst({
    where: { id: body.subscriptionId, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
  }

  await prisma.subscription.delete({
    where: { id: existing.id },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "SUBSCRIPTION_DELETE",
    resource: "Subscription",
    resourceId: existing.id,
    outcome: "SUCCESS",
  });

  return NextResponse.json({ id: existing.id, deleted: true });
}
