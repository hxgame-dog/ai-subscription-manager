"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { copyText } from "@/lib/clipboard";

type CredentialSecretPanelProps = {
  credentialId: string;
  visibilityLevel: "MASKED" | "REVEALABLE";
  status: "ACTIVE" | "DISABLED" | "ROTATED";
};

export function CredentialSecretPanel({ credentialId, visibilityLevel, status }: CredentialSecretPanelProps) {
  const router = useRouter();
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
      try {
        await copyText(data.secret);
        setMessage("明文 Key 已复制到剪贴板，并已记录审计日志。");
      } catch {
        setMessage("已拿到明文 Key，但浏览器未能写入剪贴板。");
      }
      return;
    }

    setMessage("明文 Key 仅临时显示，请注意安全。");
  }

  async function mutateCredential(action: "DISABLE" | "ENABLE" | "DELETE", promptText: string) {
    const confirmed = window.confirm(promptText);
    if (!confirmed) return;

    setLoading(true);
    setMessage(null);
    const res = await fetch(`/api/credentials/${credentialId}`, {
      method: action === "DELETE" ? "DELETE" : "PATCH",
      headers: action === "DELETE" ? undefined : { "Content-Type": "application/json" },
      body: action === "DELETE" ? undefined : JSON.stringify({ action }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setMessage(data.error || "操作失败");
      return;
    }

    if (action === "DELETE") {
      window.location.href = "/credentials";
      return;
    }

    setMessage(action === "DISABLE" ? "Key 已停用。" : "Key 已重新启用。");
    router.refresh();
  }

  async function rotateSecret() {
    const nextSecret = window.prompt("请输入新的 API Key 明文：");
    if (!nextSecret) return;

    setLoading(true);
    setMessage(null);
    const res = await fetch(`/api/credentials/${credentialId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ROTATE", newSecret: nextSecret }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setMessage(data.error || "轮换失败");
      return;
    }

    setSecret(null);
    setMessage("Key 已轮换并重新设为可用状态。");
    router.refresh();
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
      <div className="inline-actions">
        <button className="mini-button" disabled={loading} onClick={() => rotateSecret()} type="button">
          轮换
        </button>
        <button
          className="mini-button"
          disabled={loading}
          onClick={() =>
            mutateCredential(
              status === "ACTIVE" ? "DISABLE" : "ENABLE",
              status === "ACTIVE" ? "确认停用这把 Key？" : "确认重新启用这把 Key？",
            )
          }
          type="button"
        >
          {status === "ACTIVE" ? "停用" : "启用"}
        </button>
        <button
          className="mini-button"
          disabled={loading}
          onClick={() => mutateCredential("DELETE", "确认永久删除这把 Key？删除后无法恢复。")}
          type="button"
        >
          删除
        </button>
      </div>
      {secret ? <div className="secret-box">{secret}</div> : null}
      {message ? <small>{message}</small> : null}
    </div>
  );
}
