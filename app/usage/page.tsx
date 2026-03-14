import { SyncTrigger } from "@/components/sync-trigger";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureProviders } from "@/lib/providers";

export default async function UsagePage() {
  const session = await auth();
  if (!session?.user?.id) {
    return <div className="card">请先登录。</div>;
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
    <div className="grid">
      <section className="card">
        <h2>手动同步</h2>
        <SyncTrigger providers={providers.map((p) => ({ id: p.id, name: p.name }))} />
      </section>

      <section>
        <h2>同步任务</h2>
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
                <td>{j.status}</td>
                <td>{j.recordsSynced}</td>
                <td>{j.trigger}</td>
              </tr>
            ))}
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={5}>暂无任务</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section>
        <h2>最近用量记录</h2>
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
                <td colSpan={4}>暂无数据</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section>
        <h2>最近费用记录</h2>
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
                <td colSpan={4}>暂无费用数据</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
