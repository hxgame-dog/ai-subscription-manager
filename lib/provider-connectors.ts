import { subDays } from "date-fns";

import { prisma } from "@/lib/db";
import { googleApiFetch, hasGoogleServiceAccount, runBigQueryQuery } from "@/lib/google-cloud";

type SyncContext = {
  userId: string;
  providerId: string;
  providerKey: string;
};

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function clearSourceWindow(userId: string, providerId: string, sourcePrefix: string, start: Date) {
  await prisma.usageRecord.deleteMany({
    where: { userId, providerId, source: { startsWith: sourcePrefix }, recordedAt: { gte: start } },
  });
  await prisma.spendRecord.deleteMany({
    where: { userId, providerId, source: { startsWith: sourcePrefix }, recordedAt: { gte: start } },
  });
}

async function syncCursorUsage(context: SyncContext) {
  const apiKey = process.env.CURSOR_ADMIN_API_KEY;
  if (!apiKey) {
    return { handled: false, records: 0 };
  }

  const user = await prisma.user.findUnique({
    where: { id: context.userId },
    select: { email: true },
  });

  const startDate = subDays(new Date(), 7).getTime();
  const endDate = Date.now();
  const payload = {
    startDate,
    endDate,
    pageSize: 100,
    ...(user?.email ? { email: user.email, searchTerm: user.email } : {}),
  };

  const response = await fetch("https://api.cursor.com/teams/filtered-usage-events", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Cursor usage sync failed with ${response.status}`);
  }

  const data = (await response.json()) as {
    usageEvents?: Array<{
      timestamp?: string;
      model?: string;
      isTokenBasedCall?: boolean;
      numRequests?: number;
      tokenUsage?: {
        inputTokens?: number;
        outputTokens?: number;
        cacheWriteTokens?: number;
        cacheReadTokens?: number;
        totalCents?: number;
      };
      requestsCosts?: number;
    }>;
  };

  const sourcePrefix = "connector:cursor:admin-api";
  await clearSourceWindow(context.userId, context.providerId, sourcePrefix, subDays(new Date(), 7));

  let records = 0;
  for (const event of data.usageEvents || []) {
    const recordedAt = event.timestamp ? new Date(event.timestamp) : new Date();
    const inputTokens = event.tokenUsage?.inputTokens ?? 0;
    const outputTokens = event.tokenUsage?.outputTokens ?? 0;
    const requestCount = event.numRequests ?? 1;
    const cents = event.tokenUsage?.totalCents ?? event.requestsCosts ?? 0;

    await prisma.usageRecord.create({
      data: {
        userId: context.userId,
        providerId: context.providerId,
        providerModel: event.model ?? "cursor-unknown",
        model: event.model ?? "cursor-unknown",
        requestCount,
        inputTokens,
        outputTokens,
        recordedAt,
        source: `${sourcePrefix}:usage`,
      },
    });

    await prisma.spendRecord.create({
      data: {
        userId: context.userId,
        providerId: context.providerId,
        providerModel: event.model ?? "cursor-unknown",
        amount: Number((cents / 100).toFixed(4)),
        currency: "USD",
        recordedAt,
        source: `${sourcePrefix}:spend`,
      },
    });

    records += 2;
  }

  return { handled: true, records };
}

async function syncGeminiUsage(context: SyncContext) {
  const projectId = process.env.GEMINI_GCP_PROJECT_ID || process.env.GCP_PROJECT_ID;
  if (!projectId || !hasGoogleServiceAccount()) {
    return { handled: false, records: 0 };
  }

  const start = startOfUtcDay(subDays(new Date(), 7));
  const end = new Date();
  const sourcePrefix = "connector:gemini:gcp";

  await clearSourceWindow(context.userId, context.providerId, sourcePrefix, start);

  let records = 0;

  const monitoringFilter = [
    'metric.type="serviceruntime.googleapis.com/api/request_count"',
    'resource.type="consumed_api"',
    'resource.labels.service="generativelanguage.googleapis.com"',
  ].join(" AND ");

  const monitoringUrl =
    `https://monitoring.googleapis.com/v3/projects/${projectId}/timeSeries` +
    `?filter=${encodeURIComponent(monitoringFilter)}` +
    `&interval.startTime=${encodeURIComponent(start.toISOString())}` +
    `&interval.endTime=${encodeURIComponent(end.toISOString())}`;

  const monitoringResponse = await googleApiFetch(monitoringUrl);
  if (monitoringResponse?.ok) {
    const monitoringData = (await monitoringResponse.json()) as {
      timeSeries?: Array<{
        metric?: { labels?: Record<string, string> };
        points?: Array<{ interval?: { endTime?: string }; value?: { int64Value?: string } }>;
      }>;
    };

    for (const series of monitoringData.timeSeries || []) {
      for (const point of series.points || []) {
        const requestCount = Number(point.value?.int64Value ?? 0);
        if (!requestCount) continue;
        const recordedAt = point.interval?.endTime ? new Date(point.interval.endTime) : end;
        await prisma.usageRecord.create({
          data: {
            userId: context.userId,
            providerId: context.providerId,
            providerModel: series.metric?.labels?.method ?? "gemini-api",
            model: series.metric?.labels?.method ?? "gemini-api",
            requestCount,
            inputTokens: 0,
            outputTokens: 0,
            recordedAt,
            source: `${sourcePrefix}:monitoring`,
          },
        });
        records += 1;
      }
    }
  }

  const billingProjectId = process.env.GEMINI_BILLING_EXPORT_PROJECT_ID;
  const billingDataset = process.env.GEMINI_BILLING_EXPORT_DATASET;
  const billingTable = process.env.GEMINI_BILLING_EXPORT_TABLE;

  if (billingProjectId && billingDataset && billingTable) {
    const query = `
      SELECT
        DATE(usage_start_time) AS day,
        ROUND(SUM(cost), 6) AS amount,
        ROUND(SUM(CASE WHEN LOWER(sku.description) LIKE '%input%' THEN usage.amount_in_pricing_units ELSE 0 END), 2) AS input_units,
        ROUND(SUM(CASE WHEN LOWER(sku.description) LIKE '%output%' THEN usage.amount_in_pricing_units ELSE 0 END), 2) AS output_units
      FROM \`${billingProjectId}.${billingDataset}.${billingTable}\`
      WHERE usage_start_time >= TIMESTAMP("${start.toISOString()}")
        AND (
          LOWER(service.description) LIKE '%gemini%'
          OR LOWER(service.description) LIKE '%generative language%'
          OR LOWER(sku.description) LIKE '%gemini%'
        )
      GROUP BY day
      ORDER BY day DESC
      LIMIT 30
    `;

    const billingData = (await runBigQueryQuery(billingProjectId, query)) as
      | { rows?: Array<{ f?: Array<{ v?: string }> }> }
      | null;

    for (const row of billingData?.rows || []) {
      const [day, amount, inputUnits, outputUnits] = row.f?.map((field) => field.v) ?? [];
      if (!day) continue;
      await prisma.usageRecord.create({
        data: {
          userId: context.userId,
          providerId: context.providerId,
          providerModel: "gemini-billing-export",
          model: "gemini-billing-export",
          requestCount: 0,
          inputTokens: Math.round(Number(inputUnits ?? 0)),
          outputTokens: Math.round(Number(outputUnits ?? 0)),
          recordedAt: new Date(`${day}T00:00:00.000Z`),
          source: `${sourcePrefix}:billing`,
        },
      });
      await prisma.spendRecord.create({
        data: {
          userId: context.userId,
          providerId: context.providerId,
          providerModel: "gemini-billing-export",
          amount: Number(amount ?? 0),
          currency: "USD",
          recordedAt: new Date(`${day}T00:00:00.000Z`),
          source: `${sourcePrefix}:billing`,
        },
      });
      records += 2;
    }
  }

  return { handled: true, records };
}

export async function syncProviderUsage(context: SyncContext) {
  if (context.providerKey === "cursor") {
    return syncCursorUsage(context);
  }

  if (context.providerKey === "gemini") {
    return syncGeminiUsage(context);
  }

  return { handled: false, records: 0 };
}
