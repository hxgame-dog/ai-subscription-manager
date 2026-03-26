"use client";

import { useMemo, useState } from "react";

type Provider = { id: string; name: string; key?: string };
type WindowDays = 1 | 7 | 30;

type DiagnosticState = {
  providerKey: string;
  ok: boolean;
  status: "ready" | "needs_config" | "error" | "unsupported";
  summary: string;
  details: string[];
};

type PersistedDiagnostic = {
  providerKey: string;
  outcome: "SUCCESS" | "ERROR";
  createdAt: string;
  summary?: string;
};

function getStatusTone(status?: DiagnosticState["status"] | null) {
  if (status === "ready") return "success";
  if (status === "needs_config") return "warning";
  if (status === "unsupported") return "info";
  return "danger";
}

function formatWindow(windowDays: WindowDays) {
  if (windowDays === 1) return "最近 24h";
  if (windowDays === 7) return "最近 7d";
  return "最近 30d";
}

export function SyncTrigger({
  providers,
  initialDiagnostic,
}: {
  providers: Provider[];
  initialDiagnostic?: PersistedDiagnostic | null;
}) {
  const [loading, setLoading] = useState(false);
  const [diagLoading, setDiagLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [windowDays, setWindowDays] = useState<WindowDays>(7);
  const [selectedProviderId, setSelectedProviderId] = useState<string>(providers.find((p) => p.key === "cursor")?.id ?? "");
  const [lastDiagnosticAt, setLastDiagnosticAt] = useState<string | null>(initialDiagnostic?.createdAt ?? null);
  const [diagnostic, setDiagnostic] = useState<DiagnosticState | null>(
    initialDiagnostic
      ? {
          providerKey: initialDiagnostic.providerKey,
          ok: initialDiagnostic.outcome === "SUCCESS",
          status: initialDiagnostic.outcome === "SUCCESS" ? "ready" : "error",
          summary: initialDiagnostic.summary ?? "最近一次诊断结果已恢复。",
          details: [],
        }
      : null,
  );

  const selectedProvider = useMemo(() => providers.find((provider) => provider.id === selectedProviderId), [providers, selectedProviderId]);

  async function triggerSync(providerId?: string) {
    const res = await fetch("/api/usage/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ providerId, trigger: "MANUAL", windowDays }),
    });
    const data = await res.json();
    setMessage(
      res.ok
        ? data.message
          ? `同步完成，记录数: ${data.recordsSynced} · ${data.message}`
          : `同步完成，记录数: ${data.recordsSynced}`
        : data.error || "同步失败",
    );
  }

  async function onSubmit(formData: FormData) {
    setLoading(true);
    setMessage(null);
    const providerId = String(formData.get("providerId") || "") || undefined;
    await triggerSync(providerId);
    setLoading(false);
  }

  async function runDiagnostic() {
    if (!selectedProvider?.key) {
      setMessage("请先选择一个具体平台，再做诊断。");
      return;
    }

    setDiagLoading(true);
    setMessage(null);
    setDiagnostic(null);

    const res = await fetch("/api/usage/diagnose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ providerKey: selectedProvider.key }),
    });

    const data = (await res.json()) as DiagnosticState;
    setDiagLoading(false);
    setLastDiagnosticAt(new Date().toLocaleString());
    setDiagnostic(data);
    setMessage(data.summary || "诊断完成");
  }

  async function syncAfterDiagnostic() {
    if (!selectedProviderId) {
      setMessage("请先选择平台。");
      return;
    }
    setLoading(true);
    setMessage(null);
    await triggerSync(selectedProviderId);
    setLoading(false);
  }

  const selectedProviderName = selectedProvider?.name ?? "未选择平台";
  const diagnosticTone = getStatusTone(diagnostic?.status);

  return (
    <form action={onSubmit} className="sync-console">
      <div className="sync-console-grid">
        <div className="sync-main-panel">
          <div className="sync-toolbar">
            <div className="sync-toolbar-copy">
              <p className="section-kicker">Run sync</p>
              <h3>手动执行</h3>
              <p>选择平台和时间窗口，先诊断，再执行同步。</p>
            </div>
            <div className="sync-status-chips">
              <span className="meta-chip">Platform <strong>{selectedProviderName}</strong></span>
              <span className="meta-chip">Window <strong>{formatWindow(windowDays)}</strong></span>
            </div>
          </div>

          <div className="sync-control-grid">
            <label className="control-field">
              <span>平台</span>
              <select
                name="providerId"
                value={selectedProviderId}
                onChange={(e) => {
                  setSelectedProviderId(e.target.value);
                  setDiagnostic(null);
                  setMessage(null);
                }}
              >
                <option value="">全部自动同步平台</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="control-field">
              <span>时间窗口</span>
              <select value={windowDays} onChange={(e) => setWindowDays(Number(e.target.value) as WindowDays)}>
                <option value={1}>最近 24h</option>
                <option value={7}>最近 7d</option>
                <option value={30}>最近 30d</option>
              </select>
            </label>
          </div>

          <div className="sync-action-row">
            <button className="sync-primary" disabled={loading} type="submit">
              {loading ? "同步中..." : "立即同步"}
            </button>
            <button className="sync-secondary" disabled={diagLoading} type="button" onClick={runDiagnostic}>
              {diagLoading ? "诊断中..." : "先做连接诊断"}
            </button>
          </div>

          {message ? <div className="sync-inline-feedback">{message}</div> : null}
        </div>

        <aside className="sync-side-panel">
          <div className="sync-side-card">
            <p className="section-kicker">Workflow</p>
            <strong>推荐流程</strong>
            <span>先用 Cursor 跑通第一条真实链路，再切 Gemini / OpenAI 做 dry-run 与回填验证。</span>
          </div>

          <div className="sync-side-card">
            <p className="section-kicker">Last diagnostic</p>
            <strong>{lastDiagnosticAt ?? "暂无记录"}</strong>
            <span>{lastDiagnosticAt ? "最近一次诊断结果已保存，可直接继续处理。" : "先执行一次连接诊断，确认配置和权限。"}</span>
          </div>
        </aside>
      </div>

      {diagnostic ? (
        <div className="diagnostic-card diagnostic-card-strong">
          <div className="diagnostic-head">
            <div>
              <p className="section-kicker">Diagnostic</p>
              <strong>诊断结果 · {selectedProvider?.name ?? diagnostic.providerKey}</strong>
            </div>
            <span className={`badge ${diagnosticTone}`}>{diagnostic.status}</span>
          </div>
          <div className="page-block">
            <p>{diagnostic.summary}</p>
            {diagnostic.details?.length ? (
              <ul className="diagnostic-list">
                {diagnostic.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            ) : null}
          </div>
          <div className="inline-actions">
            <button className="sync-primary slim" disabled={!diagnostic.ok || loading} type="button" onClick={syncAfterDiagnostic}>
              {loading ? "同步中..." : "诊断通过后立即同步"}
            </button>
          </div>
        </div>
      ) : null}
    </form>
  );
}
