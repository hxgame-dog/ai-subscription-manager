import { subDays } from "date-fns";

import { prisma } from "@/lib/db";
import { googleApiFetch, hasGoogleServiceAccount, runBigQueryQuery } from "@/lib/google-cloud";

export type SyncContext = {
  userId: string;
  providerId: string;
  providerKey: string;
  windowDays?: 1 | 7 | 30;
};

export type ProviderSyncCapability = {
  providerKey: string;
  mode: "official" | "planned";
  label: string;
  description: string;
  docs?: string;
};

export type ProviderSyncStatus = {
  providerKey: string;
  mode: ProviderSyncCapability["mode"];
  label: string;
  description: string;
  configured: boolean;
  available: boolean;
  missing: string[];
  docs?: string;
  nextStep: string;
};

export type SyncResult = {
  handled: boolean;
  records: number;
  mode?: "official";
  status?: "synced" | "misconfigured" | "unsupported";
  missing?: string[];
  message?: string;
};

const PROVIDER_SYNC_CAPABILITIES: Record<string, ProviderSyncCapability> = {
  cursor: {
    providerKey: "cursor",
    mode: "official",
    label: "Cursor Admin API",
    description: "Pulls real Cursor team usage events from the official admin API.",
    docs: "https://cursor.com/docs/admin/api",
  },
  gemini: {
    providerKey: "gemini",
    mode: "official",
    label: "Gemini via GCP Monitoring / BigQuery",
    description: "Pulls Gemini request counts from Cloud Monitoring and optional spend/token estimates from BigQuery billing export.",
    docs: "https://cloud.google.com/monitoring/api/metrics_gcp#gcp-serviceruntime",
  },
};

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function getCursorMissingConfig() {
  return process.env.CURSOR_ADMIN_API_KEY ? [] : ["CURSOR_ADMIN_API_KEY"];
}

function getGeminiMissingConfig() {
  const missing: string[] = [];
  if (!(process.env.GEMINI_GCP_PROJECT_ID || process.env.GCP_PROJECT_ID)) {
    missing.push("GEMINI_GCP_PROJECT_ID | GCP_PROJECT_ID");
  }
  if (!hasGoogleServiceAccount()) {
    missing.push("GOOGLE_SERVICE_ACCOUNT_JSON | GCP_SERVICE_ACCOUNT_JSON");
  }
  return missing;
}

function getNextStep(providerKey: string, missing: string[], mode: "official" | "planned") {
  if (mode === "planned") {
    return "这个平台还没有真实 connector。建议先优先接 Cursor 或 Gemini 作为第一批真实同步来源。";
  }
  if (providerKey === "cursor") {
    return missing.length === 0
      ? "已经具备真实同步条件。现在去 /usage 先做诊断，再按 24h / 7d / 30d 窗口跑一次同步。"
      : "先在部署环境或本地 .env 中配置 CURSOR_ADMIN_API_KEY，然后回到 /usage 手动跑一次 Cursor 同步。";
  }
  if (providerKey === "gemini") {
    return missing.length === 0
      ? "已经具备真实同步条件。建议先验证 Cloud Monitoring 请求数，再补 BigQuery billing export 做费用回填。"
      : "先补 GCP project id 和 service account JSON；如果还想要费用数据，再补 billing export 三个环境变量。";
  }
  return missing.length === 0 ? "已可测试真实同步。" : `先补齐配置：${missing.join("、")}`;
}

export function listProviderSyncStatuses(providerKeys: string[]): ProviderSyncStatus[] {
  return providerKeys.map((providerKey) => getProviderSyncStatus(providerKey));
}

export function getProviderSyncStatus(providerKey: string): ProviderSyncStatus {
  const capability = PROVIDER_SYNC_CAPABILITIES[providerKey];
  if (!capability) {
    return {
      providerKey,
      mode: "planned",
      label: "Planned connector",
      description: "This provider is listed in the catalog, but a real sync connector has not been implemented yet.",
      configured: false,
      available: false,
      missing: ["Connector implementation"],
      nextStep: getNextStep(providerKey, ["Connector implementation"], "planned"),
    };
  }

  const missing = providerKey === "cursor" ? getCursorMissingConfig() : providerKey === "gemini" ? getGeminiMissingConfig() : [];

  return {
    providerKey,
    mode: capability.mode,
    label: capability.label,
    description: capability.description,
    configured: missing.length === 0,
    available: capability.mode === "official" && missing.length === 0,
    missing,
    docs: capability.docs,
    nextStep: getNextStep(providerKey, missing, capability.mode),
  };
}

async function clearSourceWindow(userId: string, providerId: string, sourcePrefix: string, start: Date) {
  await prisma.usageRecord.deleteMany({ where: { userId, providerId, source: { startsWith: sourcePrefix }, recordedAt: { gte: start } } });
  await prisma.spendRecord.deleteMany({ where: { userId, providerId, source: { startsWith: sourcePrefix }, recordedAt: { gte: start } } });
}

async function syncCursorUsage(context: SyncContext): Promise<SyncResult> {
  const missing = getCursorMissingConfig();
  if (missing.length > 0) return { handled: true, records: 0, mode: "official", status: "misconfigured", missing, message: `Cursor connector is not configured: ${missing.join(", ")}` };

  const windowDays = context.windowDays ?? 7;
  const apiKey = process.env.CURSOR_ADMIN_API_KEY!;
  const user = await prisma.user.findUnique({ where: { id: context.userId }, select: { email: true } });
  const activeCredential = await prisma.apiCredential.findFirst({ where: { userId: context.userId, providerId: context.providerId, status: "ACTIVE" }, orderBy: { updatedAt: "desc" }, select: { id: true } });

  const startDateObj = subDays(new Date(), windowDays);
  const startDate = startDateObj.getTime();
  const endDate = Date.now();
  const sourcePrefix = "connector:cursor:admin-api";
  await clearSourceWindow(context.userId, context.providerId, sourcePrefix, startDateObj);

  let records = 0;
  let cursor: string | null = null;
  let page = 0;

  while (page < 20) {
    const payload: Record<string, unknown> = {
      startDate,
      endDate,
      pageSize: 100,
      ...(cursor ? { cursor } : {}),
      ...(user?.email ? { email: user.email, searchTerm: user.email } : {}),
    };
    const response = await fetch("https://api.cursor.com/teams/filtered-usage-events", {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Cursor usage sync failed with ${response.status}`);

    const data = (await response.json()) as {
      usageEvents?: Array<{ timestamp?: string; model?: string; numRequests?: number; tokenUsage?: { inputTokens?: number; outputTokens?: number; totalCents?: number }; requestsCosts?: number }>;
      nextCursor?: string | null;
      cursor?: string | null;
      pagination?: { nextCursor?: string | null; hasMore?: boolean };
      hasMore?: boolean;
    };

    for (const event of data.usageEvents || []) {
      const recordedAt = event.timestamp ? new Date(event.timestamp) : new Date();
      const model = event.model ?? "cursor-unknown";
      const inputTokens = event.tokenUsage?.inputTokens ?? 0;
      const outputTokens = event.tokenUsage?.outputTokens ?? 0;
      const requestCount = event.numRequests ?? 1;
      const cents = event.tokenUsage?.totalCents ?? event.requestsCosts ?? 0;

      await prisma.usageRecord.create({ data: { userId: context.userId, providerId: context.providerId, credentialId: activeCredential?.id, providerModel: model, model, requestCount, inputTokens, outputTokens, recordedAt, source: `${sourcePrefix}:usage` } });
      await prisma.spendRecord.create({ data: { userId: context.userId, providerId: context.providerId, credentialId: activeCredential?.id, providerModel: model, amount: Number((cents / 100).toFixed(4)), currency: "USD", recordedAt, source: `${sourcePrefix}:spend` } });
      records += 2;
    }

    cursor = data.nextCursor ?? data.pagination?.nextCursor ?? data.cursor ?? null;
    const hasMore = Boolean(data.pagination?.hasMore ?? data.hasMore ?? cursor);
    page += 1;
    if (!hasMore || !cursor) break;
  }

  if (activeCredential) await prisma.apiCredential.update({ where: { id: activeCredential.id }, data: { lastUsedAt: new Date() } });

  return { handled: true, records, mode: "official", status: "synced", message: records > 0 ? `Synced ${records} Cursor records from the admin API for the last ${windowDays} day(s).` : `Cursor sync completed with no matching events in the last ${windowDays} day(s).` };
}

async function syncGeminiUsage(context: SyncContext): Promise<SyncResult> {
  const missing = getGeminiMissingConfig();
  if (missing.length > 0) return { handled: true, records: 0, mode: "official", status: "misconfigured", missing, message: `Gemini connector is not configured: ${missing.join(", ")}` };

  const windowDays = context.windowDays ?? 7;
  const projectId = process.env.GEMINI_GCP_PROJECT_ID || process.env.GCP_PROJECT_ID!;
  const activeCredential = await prisma.apiCredential.findFirst({ where: { userId: context.userId, providerId: context.providerId, status: "ACTIVE" }, orderBy: { updatedAt: "desc" }, select: { id: true } });
  const start = startOfUtcDay(subDays(new Date(), windowDays));
  const end = new Date();
  const sourcePrefix = "connector:gemini:gcp";
  await clearSourceWindow(context.userId, context.providerId, sourcePrefix, start);

  let records = 0;
  const monitoringFilter = ['metric.type="serviceruntime.googleapis.com/api/request_count"', 'resource.type="consumed_api"', 'resource.labels.service="generativelanguage.googleapis.com"'].join(" AND ");
  const monitoringUrl = `https://monitoring.googleapis.com/v3/projects/${projectId}/timeSeries?filter=${encodeURIComponent(monitoringFilter)}&interval.startTime=${encodeURIComponent(start.toISOString())}&interval.endTime=${encodeURIComponent(end.toISOString())}`;
  const monitoringResponse = await googleApiFetch(monitoringUrl);
  if (!monitoringResponse) throw new Error("Gemini sync could not authenticate to Google Cloud.");
  if (!monitoringResponse.ok) throw new Error(`Gemini monitoring sync failed with ${monitoringResponse.status}`);

  const monitoringData = (await monitoringResponse.json()) as { timeSeries?: Array<{ metric?: { labels?: Record<string, string> }; points?: Array<{ interval?: { endTime?: string }; value?: { int64Value?: string } }> }> };
  for (const series of monitoringData.timeSeries || []) {
    for (const point of series.points || []) {
      const requestCount = Number(point.value?.int64Value ?? 0);
      if (!requestCount) continue;
      const recordedAt = point.interval?.endTime ? new Date(point.interval.endTime) : end;
      const model = series.metric?.labels?.method || series.metric?.labels?.model || series.metric?.labels?.response_code || "gemini-api";
      await prisma.usageRecord.create({ data: { userId: context.userId, providerId: context.providerId, credentialId: activeCredential?.id, providerModel: model, model, requestCount, inputTokens: 0, outputTokens: 0, recordedAt, source: `${sourcePrefix}:monitoring` } });
      records += 1;
    }
  }

  const billingProjectId = process.env.GEMINI_BILLING_EXPORT_PROJECT_ID;
  const billingDataset = process.env.GEMINI_BILLING_EXPORT_DATASET;
  const billingTable = process.env.GEMINI_BILLING_EXPORT_TABLE;
  if (billingProjectId && billingDataset && billingTable) {
    const query = `SELECT DATE(usage_start_time) AS day, ROUND(SUM(cost), 6) AS amount, ROUND(SUM(CASE WHEN LOWER(sku.description) LIKE '%input%' THEN usage.amount_in_pricing_units ELSE 0 END), 2) AS input_units, ROUND(SUM(CASE WHEN LOWER(sku.description) LIKE '%output%' THEN usage.amount_in_pricing_units ELSE 0 END), 2) AS output_units FROM \`${billingProjectId}.${billingDataset}.${billingTable}\` WHERE usage_start_time >= TIMESTAMP("${start.toISOString()}") AND (LOWER(service.description) LIKE '%gemini%' OR LOWER(service.description) LIKE '%generative language%' OR LOWER(sku.description) LIKE '%gemini%') GROUP BY day ORDER BY day DESC LIMIT 30`;
    const billingData = (await runBigQueryQuery(billingProjectId, query)) as { rows?: Array<{ f?: Array<{ v?: string }> }> } | null;
    for (const row of billingData?.rows || []) {
      const [day, amount, inputUnits, outputUnits] = row.f?.map((field) => field.v) ?? [];
      if (!day) continue;
      const recordedAt = new Date(`${day}T00:00:00.000Z`);
      await prisma.usageRecord.create({ data: { userId: context.userId, providerId: context.providerId, credentialId: activeCredential?.id, providerModel: "gemini-billing-export", model: "gemini-billing-export", requestCount: 0, inputTokens: Math.round(Number(inputUnits ?? 0)), outputTokens: Math.round(Number(outputUnits ?? 0)), recordedAt, source: `${sourcePrefix}:billing` } });
      await prisma.spendRecord.create({ data: { userId: context.userId, providerId: context.providerId, credentialId: activeCredential?.id, providerModel: "gemini-billing-export", amount: Number(amount ?? 0), currency: "USD", recordedAt, source: `${sourcePrefix}:billing` } });
      records += 2;
    }
  }

  if (activeCredential) await prisma.apiCredential.update({ where: { id: activeCredential.id }, data: { lastUsedAt: new Date() } });
  return { handled: true, records, mode: "official", status: "synced", message: records > 0 ? `Synced Gemini usage from Google Cloud sources for the last ${windowDays} day(s).` : `Gemini sync completed but no monitoring or billing rows matched the last ${windowDays} day(s).` };
}

export async function syncProviderUsage(context: SyncContext): Promise<SyncResult> {
  if (context.providerKey === "cursor") return syncCursorUsage(context);
  if (context.providerKey === "gemini") return syncGeminiUsage(context);
  return { handled: false, records: 0, status: "unsupported", message: `No real sync connector has been implemented for provider: ${context.providerKey}` };
}
