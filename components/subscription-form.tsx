"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type SubscriptionFormProps = {
  providers: Array<{ id: string; name: string }>;
  initialValues?: {
    subscriptionId: string;
    providerId: string;
    planName: string;
    billingCycle: "MONTHLY" | "YEARLY" | "CUSTOM";
    price: string;
    currency: string;
    renewalDate: string;
    notes: string;
  };
  submitLabel?: string;
  onSaved?: () => void;
};

export function SubscriptionForm({
  providers,
  initialValues,
  submitLabel,
  onSaved,
}: SubscriptionFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setLoading(true);
    setMessage(null);

    const payload = initialValues
      ? {
          action: "UPDATE" as const,
          subscriptionId: initialValues.subscriptionId,
          providerId: formData.get("providerId"),
          planName: formData.get("planName"),
          billingCycle: formData.get("billingCycle"),
          price: Number(formData.get("price")),
          currency: String(formData.get("currency") || "USD"),
          renewalDate: new Date(String(formData.get("renewalDate"))).toISOString(),
          notes: formData.get("notes"),
        }
      : {
          providerId: formData.get("providerId"),
          planName: formData.get("planName"),
          billingCycle: formData.get("billingCycle"),
          price: Number(formData.get("price")),
          currency: String(formData.get("currency") || "USD"),
          renewalDate: new Date(String(formData.get("renewalDate"))).toISOString(),
          notes: formData.get("notes"),
        };

    const res = await fetch("/api/subscriptions", {
      method: initialValues ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);
    if (!res.ok) {
      setMessage("保存失败，请检查输入。");
      return;
    }

    setMessage(initialValues ? "订阅已更新。" : "订阅已创建，列表已更新。");
    if (!initialValues) {
      formRef.current?.reset();
    }
    router.refresh();
    onSaved?.();
  }

  return (
    <form action={onSubmit} className="wide-form" ref={formRef}>
      <div className="row">
        <select defaultValue={initialValues?.providerId ?? ""} name="providerId" required>
          <option value="">选择平台</option>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <input defaultValue={initialValues?.planName} name="planName" placeholder="Pro / Team" required />
      </div>
      <div className="row">
        <select name="billingCycle" defaultValue={initialValues?.billingCycle ?? "MONTHLY"}>
          <option value="MONTHLY">Monthly</option>
          <option value="YEARLY">Yearly</option>
          <option value="CUSTOM">Custom</option>
        </select>
        <input
          defaultValue={initialValues?.price}
          name="price"
          placeholder="价格"
          type="number"
          step="0.01"
          min="0"
          required
        />
      </div>
      <div className="row">
        <input name="currency" defaultValue={initialValues?.currency ?? "USD"} maxLength={3} />
        <input defaultValue={initialValues?.renewalDate} name="renewalDate" type="date" required />
      </div>
      <textarea defaultValue={initialValues?.notes} name="notes" placeholder="备注" rows={3} />
      <button disabled={loading} type="submit">
        {loading ? "保存中..." : submitLabel ?? "创建订阅"}
      </button>
      {message ? <small>{message}</small> : null}
    </form>
  );
}
