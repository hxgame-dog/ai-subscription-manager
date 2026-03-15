"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type AlertRuleFormProps = {
  providers: Array<{ id: string; name: string }>;
  initialValues?: {
    ruleId: string;
    providerId?: string;
    type: "USAGE_THRESHOLD" | "SUBSCRIPTION_RENEWAL";
    threshold?: number | null;
    renewalLeadDays?: number | null;
    isEnabled: boolean;
  };
  submitLabel?: string;
  onSaved?: () => void;
};

export function AlertRuleForm({ providers, initialValues, submitLabel, onSaved }: AlertRuleFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [type, setType] = useState<"USAGE_THRESHOLD" | "SUBSCRIPTION_RENEWAL">(
    initialValues?.type ?? "USAGE_THRESHOLD",
  );

  async function onSubmit(formData: FormData) {
    setLoading(true);
    setMessage(null);

    const nextType = String(formData.get("type")) as "USAGE_THRESHOLD" | "SUBSCRIPTION_RENEWAL";
    const payload = initialValues
      ? {
          action: "UPDATE" as const,
          ruleId: initialValues.ruleId,
          providerId: String(formData.get("providerId") || "") || undefined,
          type: nextType,
          threshold: nextType === "USAGE_THRESHOLD" ? Number(formData.get("threshold")) : undefined,
          renewalLeadDays: nextType === "SUBSCRIPTION_RENEWAL" ? Number(formData.get("renewalLeadDays")) : undefined,
          channels: ["IN_APP"] as const,
          isEnabled: initialValues.isEnabled,
        }
      : {
          providerId: String(formData.get("providerId") || "") || undefined,
          type: nextType,
          threshold: nextType === "USAGE_THRESHOLD" ? Number(formData.get("threshold")) : undefined,
          renewalLeadDays: nextType === "SUBSCRIPTION_RENEWAL" ? Number(formData.get("renewalLeadDays")) : undefined,
          channels: ["IN_APP"] as const,
          isEnabled: true,
        };

    const res = await fetch("/api/alerts/rules", {
      method: initialValues ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);
    if (!res.ok) {
      setMessage("创建失败，请检查输入。");
      return;
    }

    setMessage(initialValues ? "规则已更新。" : "规则已创建。");
    if (!initialValues) {
      formRef.current?.reset();
      setType("USAGE_THRESHOLD");
    }
    router.refresh();
    onSaved?.();
  }

  return (
    <form action={onSubmit} ref={formRef}>
      <select defaultValue={initialValues?.providerId ?? ""} name="providerId">
        <option value="">全部平台</option>
        {providers.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <select
        name="type"
        defaultValue={initialValues?.type ?? "USAGE_THRESHOLD"}
        onChange={(event) => setType(event.target.value as "USAGE_THRESHOLD" | "SUBSCRIPTION_RENEWAL")}
      >
        <option value="USAGE_THRESHOLD">额度阈值告警</option>
        <option value="SUBSCRIPTION_RENEWAL">订阅到期提醒</option>
      </select>
      <div className="row">
        {type === "USAGE_THRESHOLD" ? (
          <input
            type="number"
            name="threshold"
            defaultValue={initialValues?.threshold ?? 80}
            min={1}
            max={100}
            placeholder="80"
          />
        ) : (
          <input
            type="number"
            name="renewalLeadDays"
            defaultValue={initialValues?.renewalLeadDays ?? 7}
            min={1}
            max={30}
            placeholder="7"
          />
        )}
      </div>
      <small>当前版本默认只启用站内提醒；Email 渠道后续再接入。</small>
      <button disabled={loading} type="submit">
        {loading ? "提交中..." : submitLabel ?? "新增提醒规则"}
      </button>
      {message ? <small>{message}</small> : null}
    </form>
  );
}
