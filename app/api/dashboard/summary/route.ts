import { subDays } from "date-fns";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const now = new Date();
  const start = subDays(now, 30);

  const [usage, spend, activeSubs, alerts, jobs] = await Promise.all([
    prisma.usageRecord.aggregate({
      where: { userId, recordedAt: { gte: start, lte: now } },
      _sum: { requestCount: true, inputTokens: true, outputTokens: true },
    }),
    prisma.spendRecord.aggregate({
      where: { userId, recordedAt: { gte: start, lte: now } },
      _sum: { amount: true },
    }),
    prisma.subscription.count({ where: { userId, isActive: true } }),
    prisma.alertEvent.count({ where: { userId, createdAt: { gte: start, lte: now } } }),
    prisma.syncJob.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { provider: true },
    }),
  ]);

  return NextResponse.json({
    period: { start, end: now },
    usage: usage._sum,
    spend: { amount: Number(spend._sum.amount || 0), currency: "USD" },
    activeSubscriptions: activeSubs,
    alertsLast30Days: alerts,
    recentJobs: jobs,
  });
}
