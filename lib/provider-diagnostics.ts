import { googleApiFetch } from "@/lib/google-cloud";
import { getProviderSyncStatus } from "@/lib/provider-connectors";

export type ProviderDiagnosticResult = {
  providerKey: string;
  ok: boolean;
  status: "ready" | "needs_config" | "error" | "unsupported";
  summary: string;
  details: string[];
};

async function openaiFetch(path: string) {
  const apiKey = process.env.OPENAI_ADMIN_API_KEY;
  if (!apiKey) return null;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (process.env.OPENAI_ORG_ID) headers["OpenAI-Organization"] = process.env.OPENAI_ORG_ID;

  return fetch(`https://api.openai.com${path}`, { headers, cache: "no-store" });
}

export async function runProviderDiagnostic(providerKey: string): Promise<ProviderDiagnosticResult> {
  if (providerKey === "openai") return runOpenAIDiagnostic();
  if (providerKey === "cursor") return runCursorDiagnostic();
  if (providerKey === "gemini") return runGeminiDiagnostic();

  return {
    providerKey,
    ok: false,
    status: "unsupported",
    summary: "This provider does not have a real diagnostic yet.",
    details: ["Implement a real connector before adding diagnostics."],
  };
}

async function runOpenAIDiagnostic(): Promise<ProviderDiagnosticResult> {
  const status = getProviderSyncStatus("openai");
  if (!status.available) {
    return {
      providerKey: "openai",
      ok: false,
      status: "needs_config",
      summary: "OpenAI connector is not configured yet.",
      details: status.missing.map((item) => `Missing: ${item}`),
    };
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const startTime = now - 24 * 60 * 60;
    const response = await openaiFetch(`/v1/organization/usage/completions?start_time=${startTime}&bucket_width=1d&limit=1`);

    if (!response) {
      return {
        providerKey: "openai",
        ok: false,
        status: "error",
        summary: "OpenAI diagnostic could not authenticate.",
        details: ["Check OPENAI_ADMIN_API_KEY and confirm it has org usage access."],
      };
    }

    if (response.status === 401 || response.status === 403) {
      return {
        providerKey: "openai",
        ok: false,
        status: "error",
        summary: `OpenAI rejected the admin key (${response.status}).`,
        details: ["Use an admin-capable key for organization usage/cost endpoints. If needed, also set OPENAI_ORG_ID."],
      };
    }

    if (!response.ok) {
      return {
        providerKey: "openai",
        ok: false,
        status: "error",
        summary: `OpenAI usage probe returned ${response.status}.`,
        details: ["Inspect org scope, endpoint availability, and API permissions."],
      };
    }

    const data = (await response.json()) as { data?: Array<{ results?: unknown[] }> };
    return {
      providerKey: "openai",
      ok: true,
      status: "ready",
      summary: "OpenAI connector reached the usage endpoint successfully.",
      details: [
        `Usage buckets returned: ${data.data?.length ?? 0}`,
        `First bucket result count: ${data.data?.[0]?.results?.length ?? 0}`,
        process.env.OPENAI_ORG_ID ? `Scoped organization header enabled: ${process.env.OPENAI_ORG_ID}` : "OPENAI_ORG_ID not set; relying on key default org scope.",
      ],
    };
  } catch (error) {
    return {
      providerKey: "openai",
      ok: false,
      status: "error",
      summary: "OpenAI diagnostic failed before a stable response was returned.",
      details: [error instanceof Error ? error.message : "Unknown diagnostic error"],
    };
  }
}

async function runCursorDiagnostic(): Promise<ProviderDiagnosticResult> {
  const status = getProviderSyncStatus("cursor");
  if (!status.available) {
    return {
      providerKey: "cursor",
      ok: false,
      status: "needs_config",
      summary: "Cursor connector is not configured yet.",
      details: status.missing.map((item) => `Missing: ${item}`),
    };
  }

  const apiKey = process.env.CURSOR_ADMIN_API_KEY!;

  try {
    const response = await fetch("https://api.cursor.com/teams/filtered-usage-events", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ startDate: Date.now() - 24 * 60 * 60 * 1000, endDate: Date.now(), pageSize: 1 }),
      cache: "no-store",
    });

    if (response.status === 401 || response.status === 403) {
      return { providerKey: "cursor", ok: false, status: "error", summary: `Cursor API rejected the key (${response.status}).`, details: ["Check whether CURSOR_ADMIN_API_KEY belongs to a team admin context with usage access."] };
    }
    if (!response.ok) {
      return { providerKey: "cursor", ok: false, status: "error", summary: `Cursor API returned ${response.status}.`, details: ["Try again later or inspect the provider response in server logs."] };
    }

    const data = (await response.json()) as { usageEvents?: unknown[]; nextCursor?: string | null; pagination?: { nextCursor?: string | null } };
    return {
      providerKey: "cursor",
      ok: true,
      status: "ready",
      summary: "Cursor connector is reachable and authenticated.",
      details: [
        `Diagnostic request succeeded. Sample events returned: ${data.usageEvents?.length ?? 0}`,
        `Pagination cursor present: ${Boolean(data.nextCursor ?? data.pagination?.nextCursor)}`,
        (data.usageEvents?.length ?? 0) === 0 ? "No sample events were returned in the last 24h. Auth is OK, but you may need a wider sync window or a team/user with activity." : "Sample usage events were returned successfully.",
      ],
    };
  } catch (error) {
    return { providerKey: "cursor", ok: false, status: "error", summary: "Cursor diagnostic failed before the API could respond.", details: [error instanceof Error ? error.message : "Unknown diagnostic error"] };
  }
}

async function runGeminiDiagnostic(): Promise<ProviderDiagnosticResult> {
  const status = getProviderSyncStatus("gemini");
  if (!status.available) {
    return { providerKey: "gemini", ok: false, status: "needs_config", summary: "Gemini connector is not configured yet.", details: status.missing.map((item) => `Missing: ${item}`) };
  }

  const projectId = process.env.GEMINI_GCP_PROJECT_ID || process.env.GCP_PROJECT_ID;
  const end = new Date();
  const start = new Date(end.getTime() - 6 * 60 * 60 * 1000);
  const monitoringFilter = ['metric.type="serviceruntime.googleapis.com/api/request_count"', 'resource.type="consumed_api"', 'resource.labels.service="generativelanguage.googleapis.com"'].join(" AND ");
  const monitoringUrl = `https://monitoring.googleapis.com/v3/projects/${projectId}/timeSeries?filter=${encodeURIComponent(monitoringFilter)}&interval.startTime=${encodeURIComponent(start.toISOString())}&interval.endTime=${encodeURIComponent(end.toISOString())}&pageSize=1`;

  try {
    const monitoringResponse = await googleApiFetch(monitoringUrl);
    if (!monitoringResponse) {
      return { providerKey: "gemini", ok: false, status: "error", summary: "Gemini diagnostic could not authenticate to Google Cloud.", details: ["Check GOOGLE_SERVICE_ACCOUNT_JSON / GCP_SERVICE_ACCOUNT_JSON and verify the JSON is valid."] };
    }
    if (monitoringResponse.status === 401 || monitoringResponse.status === 403) {
      return { providerKey: "gemini", ok: false, status: "error", summary: `Google Cloud rejected the Gemini diagnostic (${monitoringResponse.status}).`, details: ["Ensure the service account has Monitoring Viewer (and BigQuery permissions if you want billing dry-run)."] };
    }
    if (!monitoringResponse.ok) {
      return { providerKey: "gemini", ok: false, status: "error", summary: `Gemini monitoring probe returned ${monitoringResponse.status}.`, details: ["Inspect project id, API enablement, and service account permissions."] };
    }

    const monitoringData = (await monitoringResponse.json()) as { timeSeries?: Array<unknown>; nextPageToken?: string };
    const details = [`Monitoring API probe succeeded for project: ${projectId}`, `Sample time series returned: ${monitoringData.timeSeries?.length ?? 0}`, `More pages available: ${Boolean(monitoringData.nextPageToken)}`];

    const billingProjectId = process.env.GEMINI_BILLING_EXPORT_PROJECT_ID;
    const billingDataset = process.env.GEMINI_BILLING_EXPORT_DATASET;
    const billingTable = process.env.GEMINI_BILLING_EXPORT_TABLE;
    if (billingProjectId && billingDataset && billingTable) {
      const query = `SELECT 1 FROM \`${billingProjectId}.${billingDataset}.${billingTable}\` LIMIT 1`;
      const billingProbe = await googleApiFetch(`https://bigquery.googleapis.com/bigquery/v2/projects/${billingProjectId}/queries`, { method: "POST", body: JSON.stringify({ query, useLegacySql: false }) });
      if (!billingProbe) details.push("BigQuery billing probe could not authenticate.");
      else if (billingProbe.ok) details.push("BigQuery billing probe succeeded.");
      else details.push(`BigQuery billing probe returned ${billingProbe.status}.`);
    } else {
      details.push("BigQuery billing export is not configured yet (optional). Monitoring-based request sync is still available.");
    }

    return { providerKey: "gemini", ok: true, status: "ready", summary: "Gemini connector passed a real Google Cloud dry-run.", details };
  } catch (error) {
    return { providerKey: "gemini", ok: false, status: "error", summary: "Gemini diagnostic failed before Google Cloud returned a stable response.", details: [error instanceof Error ? error.message : "Unknown diagnostic error"] };
  }
}
