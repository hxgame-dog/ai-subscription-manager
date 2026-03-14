"use client";

import { useState } from "react";

export function SubscriptionForm({ providers }: { providers: Array<{ id: string; name: string }> }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setLoading(true);
    setMessage(null);

    const payload = {
      providerId: formData.get("providerId"),
      planName: formData.get("planName"),
      billingCycle: formData.get("billingCycle"),
      price: Number(formData.get("price")),
      currency: String(formData.get("currency") || "USD"),
      renewalDate: new Date(String(formData.get("renewalDate"))).toISOString(),
      paymentMethod: formData.get("paymentMethod"),
      notes: formData.get("notes"),
    };

    const res = await fetch("/api/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);
    if (!res.ok) {
      setMessage("保存失败，请检查输入。");
      return;
    }

    setMessage("订阅已创建，刷新页面可见。 ");
  }

  return (
    <form action={onSubmit}>
      <div className="row">
        <select name="providerId" required>
          <option value="">选择平台</option>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <input name="planName" placeholder="Pro / Team" required />
      </div>
      <div className="row">
        <select name="billingCycle" defaultValue="MONTHLY">
          <option value="MONTHLY">Monthly</option>
          <option value="YEARLY">Yearly</option>
          <option value="CUSTOM">Custom</option>
        </select>
        <input name="price" placeholder="价格" type="number" step="0.01" min="0" required />
      </div>
      <div className="row">
        <input name="currency" defaultValue="USD" maxLength={3} />
        <input name="renewalDate" type="date" required />
      </div>
      <input name="paymentMethod" placeholder="信用卡 / Apple Pay" />
      <textarea name="notes" placeholder="备注" rows={3} />
      <button disabled={loading} type="submit">
        {loading ? "保存中..." : "创建订阅"}
      </button>
      {message ? <small>{message}</small> : null}
    </form>
  );
}
