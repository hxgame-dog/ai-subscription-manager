"use client";

import { useState } from "react";

export function AlertRuleForm({ providers }: { providers: Array<{ id: string; name: string }> }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setLoading(true);
    setMessage(null);

    const type = String(formData.get("type"));
    const payload = {
      providerId: String(formData.get("providerId") || "") || undefined,
      type,
      threshold: type === "USAGE_THRESHOLD" ? Number(formData.get("threshold")) : undefined,
      renewalLeadDays: type === "SUBSCRIPTION_RENEWAL" ? Number(formData.get("renewalLeadDays")) : undefined,
      channels: ["IN_APP", "EMAIL"],
      isEnabled: true,
    };

    const res = await fetch("/api/alerts/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);
    setMessage(res.ok ? "规则已创建" : "创建失败");
  }

  return (
    <form action={onSubmit}>
      <select name="providerId">
        <option value="">全部平台</option>
        {providers.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <select name="type" defaultValue="USAGE_THRESHOLD">
        <option value="USAGE_THRESHOLD">额度阈值告警</option>
        <option value="SUBSCRIPTION_RENEWAL">订阅到期提醒</option>
      </select>
      <div className="row">
        <input type="number" name="threshold" defaultValue={80} min={1} max={100} />
        <input type="number" name="renewalLeadDays" defaultValue={7} min={1} max={30} />
      </div>
      <button disabled={loading} type="submit">
        {loading ? "提交中..." : "新增提醒规则"}
      </button>
      {message ? <small>{message}</small> : null}
    </form>
  );
}
