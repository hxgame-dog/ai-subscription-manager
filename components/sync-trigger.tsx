"use client";

import { useMemo, useState } from "react";

type Provider = { id: string; name: string; key?: string };

export function SyncTrigger({ providers }: { providers: Provider[] }) {
  const [loading, setLoading] = useState(false);
  const [diagLoading, setDiagLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState<string>(providers.find((p) => p.key === "cursor")?.id ?? "");
  const [lastDiagnosticAt, setLastDiagnosticAt] = useState<string | null>(null);

  const selectedProvider = useMemo(
    () => providers.find((provider) => provider.id === selectedProviderId),
    [providers, selectedProviderId],
  );

  async function onSubmit(formData: FormData) {
    setLoading(true);
    setMessage(null);

    const providerId = String(formData.get("providerId") || "") || undefined;

    const res = await fetch("/api/usage/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ providerId, trigger: "MANUAL" }),
    });

    const data = await res.json();
    setLoading(false);
    setMessage(
      res.ok
        ? data.message
          ? `同步完成，记录数: ${data.recordsSynced} · ${data.message}`
          : `同步完成，记录数: ${data.recordsSynced}`
        : data.error || "同步失败",
    );
  }

  async function runDiagnostic() {
    if (!selectedProvider?.key) {
      setMessage("请先选择一个具体平台，再做诊断。");
      return;
    }

    setDiagLoading(true);
    setMessage(null);

    const res = await fetch("/api/usage/diagnose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ providerKey: selectedProvider.key }),
    });

    const data = await res.json();
    setDiagLoading(false);
    setLastDiagnosticAt(new Date().toLocaleString());

    const detailText = Array.isArray(data.details) && data.details.length ? ` · ${data.details.join(" | ")}` : "";
    setMessage(`${data.summary || "诊断完成"}${detailText}`);
  }

  return (
    <form action={onSubmit} className="wide-form">
      <div className="row">
        <select name="providerId" value={selectedProviderId} onChange={(e) => setSelectedProviderId(e.target.value)}>
          <option value="">全部自动同步平台</option>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="row">
        <button disabled={loading} type="submit">
          {loading ? "同步中..." : "立即同步"}
        </button>
        <button disabled={diagLoading} type="button" onClick={runDiagnostic}>
          {diagLoading ? "诊断中..." : "先做连接诊断"}
        </button>
      </div>

      <div className="preset-hint">
        建议先选 <strong>Cursor</strong> 跑第一条真实链路；然后切到 <strong>Gemini</strong> 做 Google Cloud dry-run。
      </div>
      {lastDiagnosticAt ? <div className="preset-hint">最近一次诊断：{lastDiagnosticAt}</div> : null}
      {message ? <small>{message}</small> : null}
    </form>
  );
}
