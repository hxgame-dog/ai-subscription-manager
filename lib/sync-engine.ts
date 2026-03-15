import { subDays } from "date-fns";

import { prisma } from "@/lib/db";
import { sendNotification } from "@/lib/notifications";
import { syncProviderUsage } from "@/lib/provider-connectors";

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

const providerModelMap: Record<string, string[]> = {
  openai: ["gpt-4o-mini", "gpt-4.1-mini"],
  gemini: ["gemini-2.0-flash", "gemini-1.5-pro"],
  anthropic: ["claude-3-5-sonnet", "claude-3-haiku"],
  groq: ["llama-3.3-70b", "mixtral-8x7b"],
  perplexity: ["sonar", "sonar-pro"],
  cohere: ["command-r", "command-r-plus"],
  mistral: ["mistral-large", "codestral"],
  replicate: ["flux-dev", "llama-3.1"],
};

async function mockProviderPull(userId: string, providerId: string, providerKey: string) {
  const now = new Date();
  const activeCredential = await prisma.apiCredential.findFirst({
    where: { userId, providerId, status: "ACTIVE" },
    orderBy: { updatedAt: "desc" },
  });

  const models = providerModelMap[providerKey] ?? ["default-model"];
  let written = 0;

  for (const providerModel of models.slice(0, 2)) {
    const requestCount = randomBetween(20, 300);
    const inputTokens = randomBetween(3000, 50000);
    const outputTokens = randomBetween(2000, 35000);
    const amount = Number((((inputTokens + outputTokens) / 1_000_000) * randomBetween(2, 8)).toFixed(4));
    const hasError = randomBetween(1, 10) > 8;

    await prisma.usageRecord.create({
      data: {
        userId,
        providerId,
        credentialId: activeCredential?.id,
        model: providerModel,
        providerModel,
        requestCount,
        inputTokens,
        outputTokens,
        statusCode: hasError ? 429 : 200,
        errorType: hasError ? "rate_limit" : null,
        recordedAt: now,
        source: `connector:${providerKey}:official-mock`,
      },
    });

    await prisma.spendRecord.create({
      data: {
        userId,
        providerId,
        credentialId: activeCredential?.id,
        providerModel,
        amount,
        currency: "USD",
        recordedAt: now,
        source: `connector:${providerKey}:official-mock`,
      },
    });

    if (activeCredential) {
      await prisma.apiCredential.update({
        where: { id: activeCredential.id },
        data: { lastUsedAt: now },
      });
    }

    written += 2;
  }

  return written;
}

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
    for (const p of providers) {
      const synced = await syncProviderUsage({
        userId: params.userId,
        providerId: p.id,
        providerKey: p.key,
      });

      if (synced.handled) {
        records += synced.records;
        continue;
      }

      records += await mockProviderPull(params.userId, p.id, p.key);
    }

    await prisma.syncJob.update({
      where: { id: job.id },
      data: { status: "SUCCESS", finishedAt: new Date(), recordsSynced: records },
    });

    await evaluateAlerts(params.userId);
    return { jobId: job.id, recordsSynced: records, status: "SUCCESS" as const };
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
