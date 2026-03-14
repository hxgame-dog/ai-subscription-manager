import { SyncTrigger } from "@/components/sync-trigger";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureProviders } from "@/lib/providers";

export default async function UsagePage() {
  const session = await auth();
  if (!session?.user?.id) {
    return <div className="empty-state">请先登录后再查看同步记录。</div>;
  }

  await ensureProviders();

  const [providers, jobs, usage, spend] = await Promise.all([
    prisma.provider.findMany({ where: { supportsAutoSync: true }, orderBy: { name: "asc" } }),
    prisma.syncJob.findMany({
      where: { userId: session.user.id },
      include: { provider: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.usageRecord.findMany({ where: { userId: session.user.id }, orderBy: { recordedAt: "desc" }, take: 20 }),
    prisma.spendRecord.findMany({ where: { userId: session.user.id }, orderBy: { recordedAt: "desc" }, take: 20 }),
  ]);

  return (
    <div className="page-stack">
      <section className="page-hero">
        <div className="hero-copy">
          <h1>同步记录</h1>
          <p>这里负责把“连接配置”转化成“真实数据流”，先验证同步任务、再观察用量和费用落表。</p>
        </div>
        <div className="hero-meta">
          <div className="meta-chip">
            Auto-sync providers <strong>{providers.length}</strong>
          </div>
          <div className="meta-chip">
            Recent jobs <strong>{jobs.length}</strong>
          </div>
        </div>
      </section>

      <div className="split-layout">
        <section className="card">
          <div className="section-head">
            <div>
              <h2>手动同步</h2>
              <p>先从手动触发开始验证，再交给定时任务每天巡检。</p>
            </div>
          </div>
          <SyncTrigger providers={providers.map((p) => ({ id: p.id, name: p.name }))} />
        </section>

        <div className="stack">
          <section className="table-card">
            <div className="card">
              <div className="section-head">
                <div>
                  <h2>同步任务</h2>
                  <p>确认触发源、状态与拉取到的记录数量是否正常。</p>
                </div>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>时间</th>
                    <th>平台</th>
                    <th>状态</th>
                    <th>记录数</th>
                    <th>触发源</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((j) => (
                    <tr key={j.id}>
                      <td>{j.createdAt.toISOString().slice(0, 19).replace("T", " ")}</td>
                      <td>{j.provider?.name || "ALL"}</td>
                      <td>
                        <span
                          className={`badge ${
                            j.status === "SUCCESS" ? "success" : j.status === "FAILED" ? "danger" : "info"
                          }`}
                        >
                          {j.status}
                        </span>
                      </td>
                      <td>{j.recordsSynced}</td>
                      <td>{j.trigger}</td>
                    </tr>
                  ))}
                  {jobs.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        <div className="empty-state">还没有同步任务。先点一次“立即同步”跑通链路。</div>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="table-card">
            <div className="card">
              <div className="section-head">
                <div>
                  <h2>最近用量记录</h2>
                  <p>观察请求量和 token 统计，确认 connector 的数据形态是否合理。</p>
                </div>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>时间</th>
                    <th>请求</th>
                    <th>Input</th>
                    <th>Output</th>
                  </tr>
                </thead>
                <tbody>
                  {usage.map((u) => (
                    <tr key={u.id}>
                      <td>{u.recordedAt.toISOString().slice(0, 19).replace("T", " ")}</td>
                      <td>{u.requestCount}</td>
                      <td>{u.inputTokens}</td>
                      <td>{u.outputTokens}</td>
                    </tr>
                  ))}
                  {usage.length === 0 ? (
                    <tr>
                      <td colSpan={4}>
                        <div className="empty-state">同步前这里会是空的，这是正常状态。</div>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="table-card">
            <div className="card">
              <div className="section-head">
                <div>
                  <h2>最近费用记录</h2>
                  <p>后续做趋势图、预算预警和账单对账都会从这里开始。</p>
                </div>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>时间</th>
                    <th>金额</th>
                    <th>币种</th>
                    <th>来源</th>
                  </tr>
                </thead>
                <tbody>
                  {spend.map((s) => (
                    <tr key={s.id}>
                      <td>{s.recordedAt.toISOString().slice(0, 19).replace("T", " ")}</td>
                      <td>{s.amount.toString()}</td>
                      <td>{s.currency}</td>
                      <td>{s.source}</td>
                    </tr>
                  ))}
                  {spend.length === 0 ? (
                    <tr>
                      <td colSpan={4}>
                        <div className="empty-state">还没有费用数据，先完成一次同步后再回来看。</div>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
