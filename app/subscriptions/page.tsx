import { SubscriptionForm } from "@/components/subscription-form";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureProviders } from "@/lib/providers";

export default async function SubscriptionsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return <div className="empty-state">请先登录后再管理订阅信息。</div>;
  }

  await ensureProviders();

  const [providers, list] = await Promise.all([
    prisma.provider.findMany({ orderBy: { name: "asc" } }),
    prisma.subscription.findMany({
      where: { userId: session.user.id },
      include: { provider: true },
      orderBy: { renewalDate: "asc" },
    }),
  ]);

  return (
    <div className="page-stack">
      <section className="page-hero">
        <div className="hero-copy">
          <h1>订阅管理</h1>
          <p>记录套餐、账单周期和续费日期，把不同 AI 工具的固定成本集中到一个地方查看。</p>
        </div>
        <div className="hero-meta">
          <div className="meta-chip">
            Active plans <strong>{list.filter((item) => item.isActive).length}</strong>
          </div>
          <div className="meta-chip">
            Providers <strong>{providers.length}</strong>
          </div>
        </div>
      </section>

      <div className="split-layout">
        <section className="card">
          <div className="section-head">
            <div>
              <h2>新增订阅</h2>
              <p>先收集周期、价格和续费日，后面才方便做成本趋势和到期提醒。</p>
            </div>
          </div>
          <SubscriptionForm providers={providers.map((p) => ({ id: p.id, name: p.name }))} />
        </section>

        <section className="table-card">
          <div className="card">
            <div className="section-head">
              <div>
                <h2>订阅列表</h2>
                <p>优先关注快到期的平台与高频使用的付费工具。</p>
              </div>
            </div>
          </div>
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
                </tr>
              </thead>
              <tbody>
                {list.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="cell-title">
                        <strong>{item.provider.name}</strong>
                        <span className="cell-subtitle">{item.provider.key}</span>
                      </div>
                    </td>
                    <td>{item.planName}</td>
                    <td>{item.billingCycle}</td>
                    <td>
                      {item.currency} {item.price.toString()}
                    </td>
                    <td>{item.renewalDate.toISOString().slice(0, 10)}</td>
                    <td>
                      <span className={`badge ${item.isActive ? "success" : "warning"}`}>
                        {item.isActive ? "Active" : "Paused"}
                      </span>
                    </td>
                  </tr>
                ))}
                {list.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="empty-state">还没有订阅记录，先新增一条 GPT、Gemini 或 Cursor 试试。</div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
