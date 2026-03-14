"use client";

import { useState } from "react";

export function CredentialForm({ providers }: { providers: Array<{ id: string; name: string }> }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setLoading(true);
    setMessage(null);

    const res = await fetch("/api/credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        providerId: formData.get("providerId"),
        label: formData.get("label"),
        secret: formData.get("secret"),
        notes: formData.get("notes"),
        visibilityLevel: formData.get("visibilityLevel"),
      }),
    });

    setLoading(false);
    setMessage(res.ok ? "API Key 已保存（加密）" : "保存失败");
  }

  return (
    <form action={onSubmit}>
      <select name="providerId" required>
        <option value="">选择平台</option>
        {providers.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <input name="label" placeholder="工作账号 / 个人账号" required />
      <input name="secret" placeholder="sk-..." required />
      <textarea name="notes" placeholder="用途备注，比如个人开发 / 生产监控" rows={3} />
      <select name="visibilityLevel" defaultValue="REVEALABLE">
        <option value="REVEALABLE">允许二次确认后查看明文</option>
        <option value="MASKED">仅允许脱敏展示</option>
      </select>
      <button disabled={loading} type="submit">
        {loading ? "保存中..." : "新增 API Key"}
      </button>
      {message ? <small>{message}</small> : null}
    </form>
  );
}
