import { subDays } from "date-fns";

import { prisma } from "@/lib/db";
import { sendNotification } from "@/lib/notifications";
import { syncProviderUsage } from "@/lib/provider-connectors";

export async function runSyncJob(params: {
  userId: string;
  providerId?: string;
  trigger: string;
}) {
  const job = await prisma.syncJob.create({
    data: {
      userId: params.userId,
      providerId: params.providerId,
      trigger: params.trigger,
      status: "RUNNING",
      startedAt: new Date(),
    },
  });

  try {
    const providers = params.providerId
      ? await prisma.provider.findMany({ where: { id: params.providerId } })
      : await prisma.provider.findMany({ where: { supportsAutoSync: true } });

    let records = 0;
    const messages: string[] = [];

    for (const p of providers) {
      const synced = await syncProviderUsage({
        userId: params.userId,
        providerId: p.id,
        providerKey: p.key,
      });

      if (!synced.handled) {
        messages.push(`${p.name}: no real connector implemented yet`);
        continue;
      }

      records += synced.records;
      if (synced.message) {
        messages.push(`${p.name}: ${synced.message}`);
      }
    }

    await prisma.syncJob.update({
      where: { id: job.id },
      data: {
        status: "SUCCESS",
        finishedAt: new Date(),
        recordsSynced: records,
        errorMessage: messages.length ? messages.join(" | ") : null,
      },
    });

    await evaluateAlerts(params.userId);
    return {
      jobId: job.id,
      recordsSynced: records,
      status: "SUCCESS" as const,
      message: messages.length ? messages.join(" | ") : undefined,
    };
  } catch (error) {
    await prisma.syncJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      },
    });
    throw error;
  }
}

async function evaluateAlerts(userId: string) {
  const [usageRules, renewalRules] = await Promise.all([
    prisma.alertRule.findMany({
      where: { userId, isEnabled: true, type: "USAGE_THRESHOLD" },
    }),
    prisma.alertRule.findMany({
      where: { userId, isEnabled: true, type: "SUBSCRIPTION_RENEWAL" },
    }),
  ]);

  for (const rule of usageRules) {
    const now = new Date();
    const start = subDays(now, 30);
    const spend = await prisma.spendRecord.aggregate({
      where: {
        userId,
        providerId: rule.providerId || undefined,
        recordedAt: { gte: start, lte: now },
      },
      _sum: { amount: true },
    });

    const budget = 100;
    const usagePct = Math.round((Number(spend._sum.amount || 0) / budget) * 100);

    if (rule.threshold && usagePct >= rule.threshold) {
      await sendNotification({
        userId,
        ruleId: rule.id,
        type: "USAGE_THRESHOLD",
        title: `Usage exceeded ${rule.threshold}%`,
        message: `Your current 30-day estimated spend reached ${usagePct}% of baseline budget.`,
        channels: rule.channels,
        metadata: { usagePct, threshold: rule.threshold },
      });
    }
  }

  for (const rule of renewalRules) {
    const leadDays = rule.renewalLeadDays ?? 7;
    const end = new Date(Date.now() + leadDays * 24 * 60 * 60 * 1000);
    const subscriptions = await prisma.subscription.findMany({
      where: {
        userId,
        isActive: true,
        renewalDate: { lte: end, gte: new Date() },
      },
      include: { provider: true },
    });

    for (const sub of subscriptions) {
      await sendNotification({
        userId,
        ruleId: rule.id,
        type: "SUBSCRIPTION_RENEWAL",
        title: `Subscription renews soon: ${sub.provider.name}`,
        message: `${sub.planName} renews on ${sub.renewalDate.toISOString().slice(0, 10)}.`,
        channels: rule.channels,
        metadata: { subscriptionId: sub.id },
      });
    }
  }
}
