import { SyncTrigger } from "@/components/sync-trigger";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureProviders } from "@/lib/providers";
import { listProviderSyncStatuses } from "@/lib/provider-connectors";

export default async function UsagePage() {
  const session = await auth();
  if (!session?.user?.id) return <div className="empty-state">请先登录后再查看同步记录。</div>;

  await ensureProviders();

  const [providers, jobs, usage, spend, lastDiagnostic] = await Promise.all([
    prisma.provider.findMany({ where: { supportsAutoSync: true }, orderBy: { name: "asc" } }),
    prisma.syncJob.findMany({ where: { userId: session.user.id }, include: { provider: true }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.usageRecord.findMany({ where: { userId: session.user.id }, orderBy: { recordedAt: "desc" }, take: 20 }),
    prisma.spendRecord.findMany({ where: { userId: session.user.id }, orderBy: { recordedAt: "desc" }, take: 20 }),
    prisma.auditLog.findFirst({ where: { userId: session.user.id, action: "SYNC_DIAGNOSE" }, orderBy: { createdAt: "desc" } }),
  ]);

  const providerStatuses = listProviderSyncStatuses(providers.map((p) => p.key));
  const statusByKey = new Map(providerStatuses.map((item) => [item.providerKey, item]));
  const readyProviders = providerStatuses.filter((item) => item.available);
  const blockedProviders = providerStatuses.filter((item) => item.mode === "official" && !item.available);

  const initialDiagnostic = lastDiagnostic
    ? {
        providerKey: lastDiagnostic.resourceId ?? "unknown",
        outcome: lastDiagnostic.outcome as "SUCCESS" | "ERROR",
        createdAt: lastDiagnostic.createdAt.toISOString().slice(0, 19).replace("T", " "),
        summary:
          typeof lastDiagnostic.metadata === "object" && lastDiagnostic.metadata && "summary" in (lastDiagnostic.metadata as Record<string, unknown>)
            ? String((lastDiagnostic.metadata as Record<string, unknown>).summary || "")
            : "最近一次诊断结果已恢复。",
      }
    : null;

  return (
    <div className="page-stack">
      <section className="page-hero">
        <div className="hero-copy">
          <p className="section-kicker">Sync</p>
          <h1>同步记录</h1>
          <p>这里是数据链路的入口。先看同步是否成功，再看用量和费用有没有正确落表，最后才考虑自动化和告警。</p>
        </div>
        <div className="hero-meta">
          <div className="meta-chip">Ready connectors <strong>{readyProviders.length}</strong></div>
          <div className="meta-chip">Last job <strong>{jobs[0]?.status ?? "None"}</strong></div>
        </div>
      </section>

      <div className="split-layout">
        <section className="card">
          <div className="section-head">
            <div>
              <h2>手动同步</h2>
              <p>每次新接一个平台时，先手动跑通，再交给定时任务每天巡检。</p>
            </div>
          </div>
          <SyncTrigger providers={providers.map((p) => ({ id: p.id, name: p.name, key: p.key }))} initialDiagnostic={initialDiagnostic} />

          <div style={{ marginTop: 20 }}>
            <div className="section-head"><div><h2>当前建议</h2><p>先把第一条真实同步链路跑通，再逐个平台扩展。</p></div></div>
            <div className="soft-card" style={{ marginTop: 12 }}>
              {readyProviders.length > 0 ? <><strong>优先验证：{readyProviders[0]?.label}</strong><span>{readyProviders[0]?.nextStep}</span></> : blockedProviders.length > 0 ? <><strong>优先补配置：{blockedProviders[0]?.label}</strong><span>{blockedProviders[0]?.nextStep}</span></> : <><strong>下一步：实现更多真实 connector</strong><span>目前自动同步平台里还没有 ready 的真实 connector，建议先完成 Cursor 或 Gemini。</span></>}
            </div>
          </div>

          <div style={{ marginTop: 20 }}>
            <div className="section-head"><div><h2>Connector readiness</h2><p>只要不是 ready 状态，就不会再写 mock 数据冒充同步成功。</p></div></div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>平台</th><th>能力</th><th>状态</th><th>说明</th></tr></thead>
                <tbody>
                  {providers.map((provider) => {
                    const status = statusByKey.get(provider.key);
                    const ready = Boolean(status?.available);
                    const planned = status?.mode === "planned";
                    const missing = status?.missing?.length ? `缺少: ${status.missing.join("、")}` : "";
                    return (
                      <tr key={provider.id}>
                        <td>{provider.name}</td>
                        <td>{status?.label ?? "Planned connector"}</td>
                        <td><span className={`badge ${ready ? "success" : planned ? "info" : "danger"}`}>{ready ? "READY" : planned ? "PLANNED" : "NEEDS_CONFIG"}</span></td>
                        <td>
                          <div>{status?.description ?? "尚未定义 connector 能力。"}</div>
                          {missing ? <div style={{ marginTop: 6 }}>{missing}</div> : null}
                          {status?.nextStep ? <div style={{ marginTop: 6 }}>Next: {status.nextStep}</div> : null}
                          {status?.docs ? <div style={{ marginTop: 6 }}><a href={status.docs} target="_blank" rel="noreferrer">查看接入文档</a></div> : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <div className="stack">
          <section className="table-card">
            <div className="table-section"><div className="section-head"><div><h2>同步任务</h2><p>优先确认触发源、状态和拉取记录数是不是合理。</p></div></div></div>
            <div className="table-wrap"><table><thead><tr><th>时间</th><th>平台</th><th>状态</th><th>记录数</th><th>触发源</th></tr></thead><tbody>{jobs.map((j) => <tr key={j.id}><td>{j.createdAt.toISOString().slice(0, 19).replace("T", " ")}</td><td>{j.provider?.name || "ALL"}</td><td><span className={`badge ${j.status === "SUCCESS" ? "success" : j.status === "FAILED" ? "danger" : "info"}`}>{j.status}</span></td><td>{j.recordsSynced}</td><td><div>{j.trigger}</div>{j.errorMessage ? <small>{j.errorMessage}</small> : null}</td></tr>)}{jobs.length === 0 ? <tr><td colSpan={5}><div className="empty-state">还没有同步任务。先点一次“立即同步”跑通链路。</div></td></tr> : null}</tbody></table></div>
          </section>

          <section className="table-card">
            <div className="table-section"><div className="section-head"><div><h2>最近用量记录</h2><p>通过最近记录，快速判断 connector 拉回来的数据形态是不是正常。</p></div></div></div>
            <div className="table-wrap"><table><thead><tr><th>时间</th><th>请求</th><th>Input</th><th>Output</th></tr></thead><tbody>{usage.map((u) => <tr key={u.id}><td>{u.recordedAt.toISOString().slice(0, 19).replace("T", " ")}</td><td>{u.requestCount}</td><td>{u.inputTokens}</td><td>{u.outputTokens}</td></tr>)}{usage.length === 0 ? <tr><td colSpan={4}><div className="empty-state">同步前这里会是空的，这是正常状态。</div></td></tr> : null}</tbody></table></div>
          </section>

          <section className="table-card">
            <div className="table-section"><div className="section-head"><div><h2>最近费用记录</h2><p>预算趋势、账单对账和费用监控，后面都会以这里为基础。</p></div></div></div>
            <div className="table-wrap"><table><thead><tr><th>时间</th><th>金额</th><th>币种</th><th>来源</th></tr></thead><tbody>{spend.map((s) => <tr key={s.id}><td>{s.recordedAt.toISOString().slice(0, 19).replace("T", " ")}</td><td>{s.amount.toString()}</td><td>{s.currency}</td><td>{s.source}</td></tr>)}{spend.length === 0 ? <tr><td colSpan={4}><div className="empty-state">还没有费用数据，先完成一次同步后再回来看。</div></td></tr> : null}</tbody></table></div>
          </section>
        </div>
      </div>
    </div>
  );
}
