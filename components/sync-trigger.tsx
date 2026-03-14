"use client";

import { useState } from "react";

export function SyncTrigger({ providers }: { providers: Array<{ id: string; name: string }> }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
    setMessage(res.ok ? `同步完成，记录数: ${data.recordsSynced}` : "同步失败");
  }

  return (
    <form action={onSubmit}>
      <select name="providerId">
        <option value="">全部自动同步平台</option>
        {providers.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <button disabled={loading} type="submit">
        {loading ? "同步中..." : "立即同步"}
      </button>
      {message ? <small>{message}</small> : null}
    </form>
  );
}
