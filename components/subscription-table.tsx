"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { SubscriptionForm } from "@/components/subscription-form";

type SubscriptionRow = {
  id: string;
  providerId: string;
  provider: string;
  providerKey: string;
  planName: string;
  billingCycle: "MONTHLY" | "YEARLY" | "CUSTOM";
  price: string;
  currency: string;
  renewalDate: string;
  notes: string | null;
  isActive: boolean;
};

export function SubscriptionTable({
  items,
  providers,
}: {
  items: SubscriptionRow[];
  providers: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const editing = items.find((item) => item.id === editingId);

  async function toggleActive(subscriptionId: string, isActive: boolean) {
    const confirmed = window.confirm(isActive ? "确认重新启用这条订阅？" : "确认暂停这条订阅？");
    if (!confirmed) return;

    const res = await fetch("/api/subscriptions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "TOGGLE_ACTIVE", subscriptionId, isActive }),
    });
    const data = await res.json();

    if (!res.ok) {
      setMessage(data.error || "状态更新失败");
      return;
    }

    setMessage(isActive ? "订阅已重新启用。" : "订阅已暂停。");
    router.refresh();
  }

  async function remove(subscriptionId: string) {
    const confirmed = window.confirm("确认删除这条订阅记录？删除后无法恢复。");
    if (!confirmed) return;

    const res = await fetch("/api/subscriptions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscriptionId }),
    });
    const data = await res.json();

    if (!res.ok) {
      setMessage(data.error || "删除失败");
      return;
    }

    setMessage("订阅已删除。");
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
              <h2>编辑订阅</h2>
              <p>修改后会立即刷新列表。停用和删除也可以在这里完成。</p>
            </div>
          </div>
          <SubscriptionForm
            initialValues={{
              subscriptionId: editing.id,
              providerId: editing.providerId,
              planName: editing.planName,
              billingCycle: editing.billingCycle,
              price: editing.price,
              currency: editing.currency,
              renewalDate: editing.renewalDate,
              notes: editing.notes ?? "",
            }}
            onSaved={() => setEditingId(null)}
            providers={providers}
            submitLabel="保存修改"
          />
          <div className="inline-actions">
            <button
              className="mini-button"
              onClick={() => toggleActive(editing.id, !editing.isActive)}
              type="button"
            >
              {editing.isActive ? "暂停订阅" : "重新启用"}
            </button>
            <button className="mini-button" onClick={() => remove(editing.id)} type="button">
              删除订阅
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
              <th>平台</th>
              <th>套餐</th>
              <th>周期</th>
              <th>价格</th>
              <th>续费日</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <div className="cell-title">
                    <strong>{item.provider}</strong>
                    <span className="cell-subtitle">{item.providerKey}</span>
                  </div>
                </td>
                <td>{item.planName}</td>
                <td>{item.billingCycle}</td>
                <td>
                  {item.currency} {item.price}
                </td>
                <td>{item.renewalDate}</td>
                <td>
                  <span className={`badge ${item.isActive ? "success" : "warning"}`}>
                    {item.isActive ? "ACTIVE" : "PAUSED"}
                  </span>
                </td>
                <td>
                  <div className="inline-actions">
                    <button className="mini-button" onClick={() => setEditingId(item.id)} type="button">
                      编辑
                    </button>
                    <button className="mini-button" onClick={() => toggleActive(item.id, !item.isActive)} type="button">
                      {item.isActive ? "停用" : "启用"}
                    </button>
                    <button className="mini-button" onClick={() => remove(item.id)} type="button">
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className="empty-state">还没有订阅记录，先新增一条 GPT、Gemini 或 Cursor 试试。</div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
