"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { AlertRuleForm } from "@/components/alert-rule-form";

type AlertRuleRow = {
  id: string;
  providerId: string | null;
  type: "USAGE_THRESHOLD" | "SUBSCRIPTION_RENEWAL";
  threshold: number | null;
  renewalLeadDays: number | null;
  channels: Array<"IN_APP" | "EMAIL">;
  isEnabled: boolean;
};

export function AlertRuleTable({
  rules,
  providers,
}: {
  rules: AlertRuleRow[];
  providers: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const editing = rules.find((rule) => rule.id === editingId);

  async function toggleRule(ruleId: string, isEnabled: boolean) {
    const confirmed = window.confirm(isEnabled ? "确认启用这条提醒规则？" : "确认停用这条提醒规则？");
    if (!confirmed) return;

    const res = await fetch("/api/alerts/rules", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "TOGGLE_ENABLED", ruleId, isEnabled }),
    });
    const data = await res.json();

    if (!res.ok) {
      setMessage(data.error || "状态更新失败");
      return;
    }

    setMessage(isEnabled ? "规则已启用。" : "规则已停用。");
    router.refresh();
  }

  async function remove(ruleId: string) {
    const confirmed = window.confirm("确认删除这条提醒规则？删除后无法恢复。");
    if (!confirmed) return;

    const res = await fetch("/api/alerts/rules", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ruleId }),
    });
    const data = await res.json();

    if (!res.ok) {
      setMessage(data.error || "删除失败");
      return;
    }

    setMessage("规则已删除。");
    setEditingId(null);
    router.refresh();
  }

  return (
    <div className="stack">
      {message ? <small>{message}</small> : null}
      {editing ? (
        <section className="card">
          <div className="section-head">
            <div>
              <h2>编辑提醒规则</h2>
              <p>修改条件后会立即刷新规则列表。</p>
            </div>
          </div>
          <AlertRuleForm
            initialValues={{
              ruleId: editing.id,
              providerId: editing.providerId ?? undefined,
              type: editing.type,
              threshold: editing.threshold,
              renewalLeadDays: editing.renewalLeadDays,
              isEnabled: editing.isEnabled,
            }}
            onSaved={() => setEditingId(null)}
            providers={providers}
            submitLabel="保存修改"
          />
          <div className="inline-actions">
            <button className="mini-button" onClick={() => toggleRule(editing.id, !editing.isEnabled)} type="button">
              {editing.isEnabled ? "停用规则" : "启用规则"}
            </button>
            <button className="mini-button" onClick={() => remove(editing.id)} type="button">
              删除规则
            </button>
            <button className="mini-button" onClick={() => setEditingId(null)} type="button">
              取消
            </button>
          </div>
        </section>
      ) : null}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>类型</th>
              <th>阈值</th>
              <th>提前天数</th>
              <th>渠道</th>
              <th>启用</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id}>
                <td>{r.type}</td>
                <td>{r.threshold ?? "-"}</td>
                <td>{r.renewalLeadDays ?? "-"}</td>
                <td>{r.channels.join(", ")}</td>
                <td>
                  <span className={`badge ${r.isEnabled ? "success" : "warning"}`}>
                    {r.isEnabled ? "ENABLED" : "DISABLED"}
                  </span>
                </td>
                <td>
                  <div className="inline-actions">
                    <button className="mini-button" onClick={() => setEditingId(r.id)} type="button">
                      编辑
                    </button>
                    <button className="mini-button" onClick={() => toggleRule(r.id, !r.isEnabled)} type="button">
                      {r.isEnabled ? "停用" : "启用"}
                    </button>
                    <button className="mini-button" onClick={() => remove(r.id)} type="button">
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rules.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className="empty-state">还没有提醒规则，建议先配一个 80% 用量阈值告警。</div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
