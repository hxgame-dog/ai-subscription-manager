import { subDays, startOfDay } from "date-fns";

import { prisma } from "@/lib/db";

function toDayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildDailyBuckets(days: number) {
  const today = startOfDay(new Date());
  const buckets = [] as Array<{ day: string; date: Date }>;

  for (let i = days - 1; i >= 0; i -= 1) {
    const date = subDays(today, i);
    buckets.push({ day: toDayKey(date), date });
  }

  return buckets;
}

export async function getDashboardOverview(userId: string) {
  const now = new Date();
  const todayStart = startOfDay(now);
  const weekStart = subDays(todayStart, 6);
  const monthStart = subDays(todayStart, 29);

  const [
    todayUsage,
    weekUsage,
    monthUsage,
    monthSpend,
    activeSubscriptions,
    activeKeys,
    subscriptions,
    activeCredentialProviders,
    recentCredentialActivity,
    upcomingRenewals,
    latestSyncJob,
    trustedUsageCount,
  ] =
    await Promise.all([
      prisma.usageRecord.aggregate({
        where: { userId, recordedAt: { gte: todayStart, lte: now } },
        _sum: { inputTokens: true, outputTokens: true, requestCount: true },
      }),
      prisma.usageRecord.aggregate({
        where: { userId, recordedAt: { gte: weekStart, lte: now } },
        _sum: { inputTokens: true, outputTokens: true, requestCount: true },
      }),
      prisma.usageRecord.aggregate({
        where: { userId, recordedAt: { gte: monthStart, lte: now } },
        _sum: { inputTokens: true, outputTokens: true, requestCount: true },
      }),
      prisma.spendRecord.aggregate({
        where: { userId, recordedAt: { gte: monthStart, lte: now } },
        _sum: { amount: true },
      }),
      prisma.subscription.count({ where: { userId, isActive: true } }),
      prisma.apiCredential.count({ where: { userId, status: "ACTIVE" } }),
      prisma.subscription.findMany({
        where: { userId, isActive: true },
        select: { billingCycle: true, price: true, provider: { select: { name: true } } },
      }),
      prisma.apiCredential.findMany({
        where: { userId, status: "ACTIVE" },
        select: { provider: { select: { name: true } } },
      }),
      prisma.apiCredential.findMany({
        where: { userId },
        include: { provider: true },
        orderBy: [{ lastViewedAt: "desc" }, { lastCopiedAt: "desc" }, { updatedAt: "desc" }],
        take: 8,
      }),
      prisma.subscription.findMany({
        where: {
          userId,
          isActive: true,
          renewalDate: { gte: now, lte: subDays(now, -7) },
        },
        include: { provider: true },
        orderBy: { renewalDate: "asc" },
        take: 5,
      }),
      prisma.syncJob.findFirst({
        where: { userId },
        include: { provider: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.usageRecord.count({
        where: {
          userId,
          NOT: {
            source: { contains: "official-mock" },
          },
        },
      }),
    ]);

  const activeProviderCount = new Set([
    ...subscriptions.map((item) => item.provider.name),
    ...activeCredentialProviders.map((item) => item.provider.name),
  ]).size;
  const monthlySubscriptionSpend = subscriptions.reduce((sum, item) => {
    const price = Number(item.price);
    if (item.billingCycle === "YEARLY") return sum + price / 12;
    return sum + price;
  }, 0);
  const trackedApis = [...subscriptions.map((item) => item.provider.name), ...activeCredentialProviders.map((item) => item.provider.name)]
    .filter((name, index, array) => array.indexOf(name) === index)
    .sort((a, b) => a.localeCompare(b));
  const topSubscriptions = subscriptions
    .map((item) => {
      const price = Number(item.price);
      const monthlyCost = item.billingCycle === "YEARLY" ? price / 12 : price;
      return {
        provider: item.provider.name,
        monthlyCost,
        billingCycle: item.billingCycle,
      };
    })
    .sort((a, b) => b.monthlyCost - a.monthlyCost)
    .slice(0, 5);
  const recentCredentialEvents = recentCredentialActivity
    .map((item) => {
      const lastActionAt =
        item.lastCopiedAt && item.lastViewedAt
          ? item.lastCopiedAt > item.lastViewedAt
            ? item.lastCopiedAt
            : item.lastViewedAt
          : item.lastCopiedAt ?? item.lastViewedAt;
      const lastActionType =
        item.lastCopiedAt && item.lastViewedAt
          ? item.lastCopiedAt > item.lastViewedAt
            ? "copied"
            : "viewed"
          : item.lastCopiedAt
            ? "copied"
            : item.lastViewedAt
              ? "viewed"
              : null;

      return {
        id: item.id,
        provider: item.provider.name,
        label: item.label,
        status: item.status,
        lastActionAt,
        lastActionType,
      };
    })
    .filter((item) => item.lastActionAt)
    .sort((a, b) => b.lastActionAt!.getTime() - a.lastActionAt!.getTime())
    .slice(0, 6);

  return {
    today: {
      inputTokens: todayUsage._sum.inputTokens ?? 0,
      outputTokens: todayUsage._sum.outputTokens ?? 0,
      totalTokens: (todayUsage._sum.inputTokens ?? 0) + (todayUsage._sum.outputTokens ?? 0),
      requests: todayUsage._sum.requestCount ?? 0,
    },
    week: {
      inputTokens: weekUsage._sum.inputTokens ?? 0,
      outputTokens: weekUsage._sum.outputTokens ?? 0,
      totalTokens: (weekUsage._sum.inputTokens ?? 0) + (weekUsage._sum.outputTokens ?? 0),
      requests: weekUsage._sum.requestCount ?? 0,
    },
    month: {
      inputTokens: monthUsage._sum.inputTokens ?? 0,
      outputTokens: monthUsage._sum.outputTokens ?? 0,
      totalTokens: (monthUsage._sum.inputTokens ?? 0) + (monthUsage._sum.outputTokens ?? 0),
      requests: monthUsage._sum.requestCount ?? 0,
      spend: Number(monthSpend._sum.amount ?? 0),
    },
    activeSubscriptions,
    activeKeys,
    activeProviderCount,
    monthlySubscriptionSpend,
    trustedUsageCount,
    trackedApis,
    topSubscriptions,
    recentCredentialEvents,
    latestSyncJob: latestSyncJob
      ? {
          status: latestSyncJob.status,
          provider: latestSyncJob.provider?.name ?? "ALL",
          createdAt: latestSyncJob.createdAt,
          recordsSynced: latestSyncJob.recordsSynced,
        }
      : null,
    upcomingRenewals: upcomingRenewals.map((item) => ({
      id: item.id,
      provider: item.provider.name,
      planName: item.planName,
      renewalDate: item.renewalDate,
    })),
  };
}

export async function getTokenSeries(userId: string, days = 7) {
  const buckets = buildDailyBuckets(days);
  const start = buckets[0]?.date ?? startOfDay(new Date());
  const rows = await prisma.usageRecord.findMany({
    where: { userId, recordedAt: { gte: start } },
    select: {
      recordedAt: true,
      providerId: true,
      provider: { select: { name: true, key: true } },
      credentialId: true,
      credential: { select: { label: true } },
      providerModel: true,
      inputTokens: true,
      outputTokens: true,
      requestCount: true,
      statusCode: true,
      errorType: true,
    },
    orderBy: { recordedAt: "asc" },
  });

  const byDay = new Map(
    buckets.map((bucket) => [
      bucket.day,
      {
        day: bucket.day,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        requests: 0,
        errors: 0,
      },
    ]),
  );
  const byProvider = new Map<string, { providerId: string; provider: string; totalTokens: number; requests: number; errors: number }>();
  const byCredential = new Map<
    string,
    { credentialId: string; label: string; totalTokens: number; requests: number; errors: number }
  >();
  const byModel = new Map<string, { model: string; totalTokens: number; requests: number; errors: number }>();

  for (const row of rows) {
    const day = toDayKey(row.recordedAt);
    const totalTokens = row.inputTokens + row.outputTokens;
    const errored = row.errorType || (row.statusCode && row.statusCode >= 400);

    const dayEntry = byDay.get(day);
    if (dayEntry) {
      dayEntry.inputTokens += row.inputTokens;
      dayEntry.outputTokens += row.outputTokens;
      dayEntry.totalTokens += totalTokens;
      dayEntry.requests += row.requestCount;
      dayEntry.errors += errored ? 1 : 0;
    }

    const providerEntry = byProvider.get(row.providerId) ?? {
      providerId: row.providerId,
      provider: row.provider.name,
      totalTokens: 0,
      requests: 0,
      errors: 0,
    };
    providerEntry.totalTokens += totalTokens;
    providerEntry.requests += row.requestCount;
    providerEntry.errors += errored ? 1 : 0;
    byProvider.set(row.providerId, providerEntry);

    if (row.credentialId) {
      const credentialEntry = byCredential.get(row.credentialId) ?? {
        credentialId: row.credentialId,
        label: row.credential?.label ?? "Unnamed key",
        totalTokens: 0,
        requests: 0,
        errors: 0,
      };
      credentialEntry.totalTokens += totalTokens;
      credentialEntry.requests += row.requestCount;
      credentialEntry.errors += errored ? 1 : 0;
      byCredential.set(row.credentialId, credentialEntry);
    }

    if (row.providerModel) {
      const modelEntry = byModel.get(row.providerModel) ?? {
        model: row.providerModel,
        totalTokens: 0,
        requests: 0,
        errors: 0,
      };
      modelEntry.totalTokens += totalTokens;
      modelEntry.requests += row.requestCount;
      modelEntry.errors += errored ? 1 : 0;
      byModel.set(row.providerModel, modelEntry);
    }
  }

  return {
    series: buckets.map((bucket) => byDay.get(bucket.day)!),
    topProviders: [...byProvider.values()].sort((a, b) => b.totalTokens - a.totalTokens).slice(0, 8),
    topCredentials: [...byCredential.values()].sort((a, b) => b.totalTokens - a.totalTokens).slice(0, 8),
    topModels: [...byModel.values()].sort((a, b) => b.totalTokens - a.totalTokens).slice(0, 8),
  };
}

export async function getSpendSeries(userId: string, days = 30) {
  const buckets = buildDailyBuckets(days);
  const start = buckets[0]?.date ?? startOfDay(new Date());
  const rows = await prisma.spendRecord.findMany({
    where: { userId, recordedAt: { gte: start } },
    include: { provider: true, credential: { select: { label: true } } },
    orderBy: { recordedAt: "asc" },
  });

  const byDay = new Map(buckets.map((bucket) => [bucket.day, { day: bucket.day, amount: 0 }]));
  const byProvider = new Map<string, { providerId: string; provider: string; amount: number }>();
  const byCredential = new Map<string, { credentialId: string; label: string; amount: number }>();

  for (const row of rows) {
    const day = toDayKey(row.recordedAt);
    const amount = Number(row.amount);
    const dayEntry = byDay.get(day);
    if (dayEntry) {
      dayEntry.amount += amount;
    }

    const providerEntry = byProvider.get(row.providerId) ?? {
      providerId: row.providerId,
      provider: row.provider.name,
      amount: 0,
    };
    providerEntry.amount += amount;
    byProvider.set(row.providerId, providerEntry);

    if (row.credentialId) {
      const credentialEntry = byCredential.get(row.credentialId) ?? {
        credentialId: row.credentialId,
        label: row.credential?.label ?? "Unnamed key",
        amount: 0,
      };
      credentialEntry.amount += amount;
      byCredential.set(row.credentialId, credentialEntry);
    }
  }

  return {
    series: buckets.map((bucket) => byDay.get(bucket.day)!),
    topProviders: [...byProvider.values()].sort((a, b) => b.amount - a.amount).slice(0, 8),
    topCredentials: [...byCredential.values()].sort((a, b) => b.amount - a.amount).slice(0, 8),
  };
}

export async function getCredentialUsageStats(userId: string, credentialId: string) {
  const [credential, usageRows, spendRows, accessEvents] = await Promise.all([
    prisma.apiCredential.findFirst({
      where: { id: credentialId, userId },
      include: { provider: true },
    }),
    prisma.usageRecord.findMany({
      where: { userId, credentialId },
      orderBy: { recordedAt: "desc" },
      take: 60,
    }),
    prisma.spendRecord.findMany({
      where: { userId, credentialId },
      orderBy: { recordedAt: "desc" },
      take: 60,
    }),
    prisma.credentialAccessEvent.findMany({
      where: { userId, credentialId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  if (!credential) {
    return null;
  }

  const totals = usageRows.reduce(
    (acc, row) => {
      acc.requests += row.requestCount;
      acc.inputTokens += row.inputTokens;
      acc.outputTokens += row.outputTokens;
      acc.totalTokens += row.inputTokens + row.outputTokens;
      if (row.errorType || (row.statusCode && row.statusCode >= 400)) {
        acc.errors += 1;
      }
      return acc;
    },
    { requests: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, errors: 0 },
  );

  const spend = spendRows.reduce((sum, row) => sum + Number(row.amount), 0);
  const models = Array.from(
    new Set(usageRows.map((row) => row.providerModel ?? row.model).filter(Boolean)),
  ) as string[];

  return {
    credential,
    totals: {
      ...totals,
      spend,
    },
    models,
    latestUsage: usageRows.slice(0, 10),
    latestSpend: spendRows.slice(0, 10),
    accessEvents,
  };
}

export async function getProviderDailyStats(userId: string, providerId: string, days = 30) {
  const buckets = buildDailyBuckets(days);
  const start = buckets[0]?.date ?? startOfDay(new Date());
  const provider = await prisma.provider.findFirst({ where: { id: providerId } });
  if (!provider) {
    return null;
  }

  const [usageRows, spendRows] = await Promise.all([
    prisma.usageRecord.findMany({
      where: { userId, providerId, recordedAt: { gte: start } },
      orderBy: { recordedAt: "asc" },
    }),
    prisma.spendRecord.findMany({
      where: { userId, providerId, recordedAt: { gte: start } },
      orderBy: { recordedAt: "asc" },
    }),
  ]);

  const usageMap = new Map(buckets.map((bucket) => [bucket.day, { day: bucket.day, requests: 0, totalTokens: 0, spend: 0 }]));
  for (const row of usageRows) {
    const day = toDayKey(row.recordedAt);
    const entry = usageMap.get(day);
    if (entry) {
      entry.requests += row.requestCount;
      entry.totalTokens += row.inputTokens + row.outputTokens;
    }
  }
  for (const row of spendRows) {
    const day = toDayKey(row.recordedAt);
    const entry = usageMap.get(day);
    if (entry) {
      entry.spend += Number(row.amount);
    }
  }

  return {
    provider: { id: provider.id, key: provider.key, name: provider.name },
    series: buckets.map((bucket) => usageMap.get(bucket.day)!),
  };
}
