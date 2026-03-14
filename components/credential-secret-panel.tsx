"use client";

import { useState } from "react";

type CredentialSecretPanelProps = {
  credentialId: string;
  visibilityLevel: "MASKED" | "REVEALABLE";
};

export function CredentialSecretPanel({ credentialId, visibilityLevel }: CredentialSecretPanelProps) {
  const [secret, setSecret] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function accessSecret(action: "REVEAL" | "COPY") {
    if (visibilityLevel !== "REVEALABLE") {
      setMessage("该密钥被标记为仅脱敏展示。");
      return;
    }

    const confirmed = window.confirm(action === "REVEAL" ? "确认查看完整明文 Key？" : "确认复制完整明文 Key？");
    if (!confirmed) return;

    setLoading(true);
    setMessage(null);
    const res = await fetch(`/api/credentials/${credentialId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, confirmed: true }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setMessage(data.error || "操作失败");
      return;
    }

    setSecret(data.secret);
    if (action === "COPY") {
      await navigator.clipboard.writeText(data.secret);
      setMessage("明文 Key 已复制到剪贴板，并已记录审计日志。");
      return;
    }

    setMessage("明文 Key 仅临时显示，请注意安全。");
  }

  return (
    <div className="stack">
      <div className="cta-row">
        <button className="cta-button primary" disabled={loading} onClick={() => accessSecret("REVEAL")} type="button">
          {loading ? "处理中..." : "查看明文"}
        </button>
        <button className="cta-button secondary" disabled={loading} onClick={() => accessSecret("COPY")} type="button">
          复制 Key
        </button>
      </div>
      {secret ? <div className="secret-box">{secret}</div> : null}
      {message ? <small>{message}</small> : null}
    </div>
  );
}
