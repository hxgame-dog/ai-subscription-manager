import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { subscriptionSchema } from "@/lib/validators";

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
