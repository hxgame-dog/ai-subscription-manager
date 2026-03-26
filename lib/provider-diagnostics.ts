import { getProviderSyncStatus } from "@/lib/provider-connectors";

export type ProviderDiagnosticResult = {
  providerKey: string;
  ok: boolean;
  status: "ready" | "needs_config" | "error" | "unsupported";
  summary: string;
  details: string[];
};

export async function runProviderDiagnostic(providerKey: string): Promise<ProviderDiagnosticResult> {
  if (providerKey === "cursor") {
    return runCursorDiagnostic();
  }

  if (providerKey === "gemini") {
    return runGeminiDiagnostic();
  }

  return {
    providerKey,
    ok: false,
    status: "unsupported",
    summary: "This provider does not have a real diagnostic yet.",
    details: ["Implement a real connector before adding diagnostics."],
  };
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
      body: JSON.stringify({
        startDate: Date.now() - 24 * 60 * 60 * 1000,
        endDate: Date.now(),
        pageSize: 1,
      }),
      cache: "no-store",
    });

    if (response.status === 401 || response.status === 403) {
      return {
        providerKey: "cursor",
        ok: false,
        status: "error",
        summary: `Cursor API rejected the key (${response.status}).`,
        details: ["Check whether CURSOR_ADMIN_API_KEY belongs to a team admin context with usage access."],
      };
    }

    if (!response.ok) {
      return {
        providerKey: "cursor",
        ok: false,
        status: "error",
        summary: `Cursor API returned ${response.status}.`,
        details: ["Try again later or inspect the provider response in server logs."],
      };
    }

    const data = (await response.json()) as {
      usageEvents?: unknown[];
      nextCursor?: string | null;
      pagination?: { nextCursor?: string | null };
    };

    return {
      providerKey: "cursor",
      ok: true,
      status: "ready",
      summary: "Cursor connector is reachable and authenticated.",
      details: [
        `Diagnostic request succeeded. Sample events returned: ${data.usageEvents?.length ?? 0}`,
        `Pagination cursor present: ${Boolean(data.nextCursor ?? data.pagination?.nextCursor)}`,
      ],
    };
  } catch (error) {
    return {
      providerKey: "cursor",
      ok: false,
      status: "error",
      summary: "Cursor diagnostic failed before the API could respond.",
      details: [error instanceof Error ? error.message : "Unknown diagnostic error"],
    };
  }
}

async function runGeminiDiagnostic(): Promise<ProviderDiagnosticResult> {
  const status = getProviderSyncStatus("gemini");
  if (!status.available) {
    return {
      providerKey: "gemini",
      ok: false,
      status: "needs_config",
      summary: "Gemini connector is not configured yet.",
      details: status.missing.map((item) => `Missing: ${item}`),
    };
  }

  return {
    providerKey: "gemini",
    ok: true,
    status: "ready",
    summary: "Gemini connector config looks complete.",
    details: ["Deep API dry-run is not implemented yet, but required config is present."],
  };
}
