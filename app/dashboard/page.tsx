import { auth } from "@/lib/auth";
import { getDashboardOverview, getSpendSeries, getTokenSeries } from "@/lib/dashboard";
import { ensureProviders } from "@/lib/providers";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return <div className="empty-state">请先登录。线上正式使用前建议尽快补齐 Google OAuth。</div>;
  }

  await ensureProviders();

  const [overview, tokenStats, spendStats] = await Promise.all([
    getDashboardOverview(session.user.id),
    getTokenSeries(session.user.id, 7),
    getSpendSeries(session.user.id, 30),
  ]);

  return (
    <div className="page-stack">
      <section className="page-hero">
        <div className="hero-copy">
          <p className="section-kicker">Overview</p>
          <h1>AI 资产控制台</h1>
          <p>
            今天最值得看的，是你的 Key 是否活跃、最近 7 天的 Token 变化、以及本月费用是否还在预期内。先把最常用的信息摆在桌面上。
          </p>
        </div>
        <div className="hero-meta">
          <div className="meta-chip">
            Last 7d <strong>{overview.week.totalTokens} tokens</strong>
          </div>
          <div className="meta-chip">
            Keys active <strong>{overview.activeKeys}</strong>
          </div>
        </div>
      </section>

      <section className="grid cols-4">
        <article className="stat-card">
          <span className="stat-kicker">Today tokens</span>
          <strong className="stat-value">{overview.today.totalTokens}</strong>
          <p className="stat-note">今日输入与输出 Token 总量。</p>
        </article>
        <article className="stat-card">
          <span className="stat-kicker">Month spend</span>
          <strong className="stat-value">${overview.month.spend.toFixed(4)}</strong>
          <p className="stat-note">最近 30 天累计费用（USD）。</p>
        </article>
        <article className="stat-card">
          <span className="stat-kicker">Active plans</span>
          <strong className="stat-value">{overview.activeSubscriptions}</strong>
          <p className="stat-note">当前正在追踪的有效订阅数。</p>
        </article>
        <article className="stat-card">
          <span className="stat-kicker">Week requests</span>
          <strong className="stat-value">{overview.week.requests}</strong>
          <p className="stat-note">最近 7 天累计请求次数。</p>
        </article>
      </section>

      <section className="grid cols-3">
        <article className="insight-card">
          <div className="section-head">
              <div>
                <h2>7 天 Token 趋势</h2>
                <p>每天看一眼，就能知道最近有没有新的平台切换、消耗抬升或调用波动。</p>
              </div>
            </div>
          {tokenStats.series.map((entry) => (
            <div className="metric-line" key={entry.day}>
              <span>{entry.day}</span>
              <strong>{entry.totalTokens} tokens</strong>
            </div>
          ))}
        </article>

        <article className="insight-card">
          <div className="section-head">
              <div>
                <h2>平台排行</h2>
                <p>先分清楚哪几个平台最常被使用，再决定后面要不要做更细的自动统计。</p>
              </div>
            </div>
          {tokenStats.topProviders.length ? (
            tokenStats.topProviders.map((entry) => (
              <div className="metric-line" key={entry.providerId}>
                <span>{entry.provider}</span>
                <strong>{entry.totalTokens} tokens</strong>
              </div>
            ))
          ) : (
            <div className="empty-state">还没有平台级消耗数据，先去同步一次。</div>
          )}
        </article>

        <article className="insight-card">
          <div className="section-head">
              <div>
                <h2>关键资产</h2>
                <p>把最值得关注的 Key、模型和即将续费的项目放在一起，减少来回查找。</p>
              </div>
            </div>
          {tokenStats.topCredentials.slice(0, 3).map((entry) => (
            <div className="metric-line" key={entry.credentialId}>
              <span>{entry.label}</span>
              <strong>{entry.totalTokens} tokens</strong>
            </div>
          ))}
          {tokenStats.topModels.slice(0, 2).map((entry) => (
            <div className="metric-line" key={entry.model}>
              <span>{entry.model}</span>
              <strong>{entry.totalTokens} tokens</strong>
            </div>
          ))}
          {overview.upcomingRenewals[0] ? (
            <div className="metric-line">
              <span>最近续费</span>
              <strong>
                {overview.upcomingRenewals[0].provider} /{" "}
                {overview.upcomingRenewals[0].renewalDate.toISOString().slice(0, 10)}
              </strong>
            </div>
          ) : null}
        </article>
      </section>

      <section className="grid cols-2">
        <article className="table-card">
          <div className="card">
            <div className="section-head">
              <div>
                <h2>30 天费用趋势</h2>
                <p>做预算监控和平台成本比较时，优先看这部分。</p>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>日期</th>
                    <th>费用</th>
                  </tr>
                </thead>
                <tbody>
                  {spendStats.series.slice(-10).map((entry) => (
                    <tr key={entry.day}>
                      <td>{entry.day}</td>
                      <td>${entry.amount.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </article>

        <article className="table-card">
          <div className="card">
            <div className="section-head">
              <div>
                <h2>费用 Top Providers</h2>
                <p>判断哪个平台正在成为本月预算主力。</p>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>平台</th>
                    <th>费用</th>
                  </tr>
                </thead>
                <tbody>
                  {spendStats.topProviders.map((entry) => (
                    <tr key={entry.providerId}>
                      <td>{entry.provider}</td>
                      <td>${entry.amount.toFixed(4)}</td>
                    </tr>
                  ))}
                  {!spendStats.topProviders.length ? (
                    <tr>
                      <td colSpan={2}>
                        <div className="empty-state">还没有费用记录，先同步一次使用数据。</div>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
