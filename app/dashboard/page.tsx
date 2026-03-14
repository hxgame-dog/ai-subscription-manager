import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureProviders } from "@/lib/providers";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return <div className="empty-state">请先登录。线上正式使用前建议尽快补齐 Google OAuth。</div>;
  }

  await ensureProviders();

  const [subCount, credCount, syncCount, spend, latestSub, latestJob] = await Promise.all([
    prisma.subscription.count({ where: { userId: session.user.id, isActive: true } }),
    prisma.apiCredential.count({ where: { userId: session.user.id, status: "ACTIVE" } }),
    prisma.syncJob.count({ where: { userId: session.user.id } }),
    prisma.spendRecord.aggregate({ where: { userId: session.user.id }, _sum: { amount: true } }),
    prisma.subscription.findFirst({
      where: { userId: session.user.id, isActive: true },
      include: { provider: true },
      orderBy: { renewalDate: "asc" },
    }),
    prisma.syncJob.findFirst({
      where: { userId: session.user.id },
      include: { provider: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const totalSpend = Number(spend._sum.amount || 0).toFixed(4);

  return (
    <div className="page-stack">
      <section className="page-hero">
        <div className="hero-copy">
          <h1>AI 资产总览</h1>
          <p>
            用一个视图跟踪订阅、花费、密钥可用性与同步健康度。这个页面更像你的 AI
            运维驾驶舱，而不是普通后台首页。
          </p>
        </div>
        <div className="hero-meta">
          <div className="meta-chip">
            Current stack <strong>Vercel + Neon</strong>
          </div>
          <div className="meta-chip">
            Active credentials <strong>{credCount}</strong>
          </div>
        </div>
      </section>

      <section className="grid cols-4">
        <article className="stat-card">
          <span className="stat-kicker">Subscriptions</span>
          <strong className="stat-value">{subCount}</strong>
          <p className="stat-note">正在追踪的有效订阅数量。</p>
        </article>
        <article className="stat-card">
          <span className="stat-kicker">Vault</span>
          <strong className="stat-value">{credCount}</strong>
          <p className="stat-note">处于激活状态、可用于同步的 API Key。</p>
        </article>
        <article className="stat-card">
          <span className="stat-kicker">Sync Jobs</span>
          <strong className="stat-value">{syncCount}</strong>
          <p className="stat-note">累计同步任务次数，包含手动与定时触发。</p>
        </article>
        <article className="stat-card">
          <span className="stat-kicker">Spend</span>
          <strong className="stat-value">${totalSpend}</strong>
          <p className="stat-note">当前累计记录到的花费（USD）。</p>
        </article>
      </section>

      <section className="grid cols-2">
        <article className="insight-card">
          <div className="section-head">
            <div>
              <h2>近期节奏</h2>
              <p>优先关注即将续费的订阅和最近一次同步状态。</p>
            </div>
          </div>
          {latestSub ? (
            <div className="metric-line">
              <span>最近到期订阅</span>
              <strong>
                {latestSub.provider.name} / {latestSub.renewalDate.toISOString().slice(0, 10)}
              </strong>
            </div>
          ) : (
            <div className="empty-state">还没有订阅数据，可以先去“订阅管理”创建第一条记录。</div>
          )}
          {latestJob ? (
            <>
              <div className="metric-line">
                <span>最新同步来源</span>
                <strong>{latestJob.trigger}</strong>
              </div>
              <div className="metric-line">
                <span>最新同步状态</span>
                <strong>{latestJob.status}</strong>
              </div>
            </>
          ) : null}
        </article>

        <article className="insight-card">
          <div className="section-head">
            <div>
              <h2>推荐动作</h2>
              <p>先补最影响可用性的配置，再把数据流跑通。</p>
            </div>
          </div>
          <div className="metric-line">
            <span>登录系统</span>
            <strong>Google OAuth 待配置</strong>
          </div>
          <div className="metric-line">
            <span>费用同步</span>
            <strong>可先用手动同步验证链路</strong>
          </div>
          <div className="metric-line">
            <span>提醒能力</span>
            <strong>先站内，后补真实邮件发送</strong>
          </div>
        </article>
      </section>
    </div>
  );
}
