"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { copyText } from "@/lib/clipboard";

type CredentialRow = {
  id: string;
  provider: string;
  providerKey: string;
  label: string;
  notes: string | null;
  fingerprint: string;
  maskedValue: string;
  status: string;
  lastUsedAt: string | null;
};

export function CredentialVaultTable({ items }: { items: CredentialRow[] }) {
  const [query, setQuery] = useState("");
  const [providerFilter, setProviderFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [message, setMessage] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const providers = useMemo(
    () => Array.from(new Set(items.map((item) => item.providerKey))).sort((a, b) => a.localeCompare(b)),
    [items],
  );

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchQuery =
        !keyword ||
        item.provider.toLowerCase().includes(keyword) ||
        item.providerKey.toLowerCase().includes(keyword) ||
        item.label.toLowerCase().includes(keyword) ||
        (item.notes || "").toLowerCase().includes(keyword) ||
        item.fingerprint.toLowerCase().includes(keyword);
      const matchProvider = providerFilter === "ALL" || item.providerKey === providerFilter;
      const matchStatus = statusFilter === "ALL" || item.status === statusFilter;
      return matchQuery && matchProvider && matchStatus;
    });
  }, [items, providerFilter, query, statusFilter]);

  async function quickCopy(credentialId: string) {
    const confirmed = window.confirm("确认直接复制这把 API Key 的明文？该操作会写入审计日志。");
    if (!confirmed) return;

    setLoadingId(credentialId);
    setMessage(null);
    const res = await fetch(`/api/credentials/${credentialId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "COPY", confirmed: true }),
    });
    const data = await res.json();
    setLoadingId(null);

    if (!res.ok) {
      setMessage(data.error || "复制失败");
      return;
    }

    try {
      await copyText(data.secret);
      setMessage("明文 Key 已复制到剪贴板。");
    } catch {
      setMessage("已拿到明文 Key，但浏览器未能写入剪贴板。");
    }
  }

  return (
    <div className="stack">
      <div className="filter-bar">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索平台、标签、备注、指纹"
        />
        <select onChange={(event) => setProviderFilter(event.target.value)} value={providerFilter}>
          <option value="ALL">全部平台</option>
          {providers.map((provider) => (
            <option key={provider} value={provider}>
              {provider}
            </option>
          ))}
        </select>
        <select onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
          <option value="ALL">全部状态</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="DISABLED">DISABLED</option>
          <option value="ROTATED">ROTATED</option>
        </select>
      </div>

      <div className="table-tools">
        <span>{filtered.length} 条结果</span>
        {message ? <small>{message}</small> : <span>复制动作会写入审计日志</span>}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>平台</th>
              <th>标签</th>
              <th>指纹</th>
              <th>脱敏展示</th>
              <th>最近使用</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.id}>
                <td>
                  <div className="cell-title">
                    <strong>
                      <Link href={`/credentials/${item.id}`}>{item.provider}</Link>
                    </strong>
                    <span className="cell-subtitle">{item.providerKey}</span>
                  </div>
                </td>
                <td>
                  <div className="cell-title">
                    <strong>
                      <Link href={`/credentials/${item.id}`}>{item.label}</Link>
                    </strong>
                    <span className="cell-subtitle">{item.notes || "无备注"}</span>
                  </div>
                </td>
                <td>{item.fingerprint}</td>
                <td>{item.maskedValue}</td>
                <td>{item.lastUsedAt ? item.lastUsedAt.slice(0, 19).replace("T", " ") : "-"}</td>
                <td>
                  <span
                    className={`badge ${
                      item.status === "ACTIVE" ? "success" : item.status === "DISABLED" ? "warning" : "info"
                    }`}
                  >
                    {item.status}
                  </span>
                </td>
                <td>
                  <div className="inline-actions">
                    <Link className="mini-button" href={`/credentials/${item.id}`}>
                      详情
                    </Link>
                    <button
                      className="mini-button primary-mini"
                      disabled={loadingId === item.id}
                      onClick={() => quickCopy(item.id)}
                      type="button"
                    >
                      {loadingId === item.id ? "复制中..." : "复制"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className="empty-state">没有匹配结果。可以换个关键词，或先新增一条密钥。</div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
