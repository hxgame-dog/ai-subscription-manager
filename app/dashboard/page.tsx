import { auth } from "@/lib/auth";
import { getDashboardOverview, getTokenSeries } from "@/lib/dashboard";
import { ensureProviders } from "@/lib/providers";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return <div className="empty-state">请先登录。线上正式使用前建议尽快补齐 Google OAuth。</div>;
  }

  await ensureProviders();

  const [overview, tokenStats] = await Promise.all([
    getDashboardOverview(session.user.id),
    getTokenSeries(session.user.id, 7),
  ]);
  const hasTrustedUsage = overview.trustedUsageCount > 0;

  return (
    <div className="page-stack">
      <section className="page-hero">
        <div className="hero-copy">
          <p className="section-kicker">Overview</p>
          <h1>AI 资产控制台</h1>
          <p>
            这里优先回答四件事：你每月固定订阅花多少钱、目前管理着哪些 API、哪些平台已经被你录入，以及同步数据能不能真的拿来判断消耗。
          </p>
        </div>
        <div className="hero-meta">
          <div className="meta-chip">
            Sync status <strong>{hasTrustedUsage ? "Connected" : "Pending"}</strong>
          </div>
          <div className="meta-chip">
            Keys active <strong>{overview.activeKeys}</strong>
          </div>
        </div>
      </section>

      {!hasTrustedUsage ? (
        <section className="empty-state">
          当前还没有与真实 API 消耗打通的数据源。控制台里的 Token / 请求统计如果来自 mock 同步，只能当演示数据看，不能作为真实消耗判断。
          现阶段更可信的是：订阅月成本、已录入的 API 资产、最近同步状态。
        </section>
      ) : null}

      <section className="workspace-section">
        <div className="workspace-section-head">
          <div>
            <p className="section-kicker">Workspace block</p>
            <h2>月订阅花费</h2>
            <p>把固定成本、有效订阅和最近续费聚在一起，先回答 “我每个月稳定花多少钱”。</p>
          </div>
        </div>

        <section className="summary-card-grid">
          <article className="stat-card">
            <span className="stat-kicker">Monthly fixed cost</span>
            <strong className="stat-value">${overview.monthlySubscriptionSpend.toFixed(2)}</strong>
            <p className="stat-note">按当前有效订阅折算的月固定成本。</p>
          </article>
          <article className="stat-card">
            <span className="stat-kicker">Active plans</span>
            <strong className="stat-value">{overview.activeSubscriptions}</strong>
            <p className="stat-note">当前仍在追踪中的有效订阅数。</p>
          </article>
          <article className="stat-card">
            <span className="stat-kicker">Next renewal</span>
            <strong className="stat-value dashboard-metric-text">
              {overview.upcomingRenewals[0]?.provider ?? "None"}
            </strong>
            <p className="stat-note">
              {overview.upcomingRenewals[0]
                ? overview.upcomingRenewals[0].renewalDate.toISOString().slice(0, 10)
                : "暂无即将续费项目"}
            </p>
          </article>
        </section>

        <section className="grid cols-2">
          <article className="insight-card">
            <div className="section-head">
              <div>
                <h2>订阅与续费</h2>
                <p>优先知道你当前订阅着什么、每月固定成本是多少，以及最近哪几个工具要续费。</p>
              </div>
            </div>
            <div className="info-list">
              <div className="info-row">
                <span>有效订阅</span>
                <strong>{overview.activeSubscriptions}</strong>
              </div>
              <div className="info-row">
                <span>月固定成本</span>
                <strong>${overview.monthlySubscriptionSpend.toFixed(2)}</strong>
              </div>
              <div className="info-row">
                <span>最近续费</span>
                <strong>
                  {overview.upcomingRenewals[0]
                    ? `${overview.upcomingRenewals[0].provider} · ${overview.upcomingRenewals[0].renewalDate
                        .toISOString()
                        .slice(0, 10)}`
                    : "暂无"}
                </strong>
              </div>
            </div>
          </article>

          <article className="table-card">
            <div className="card">
              <div className="section-head">
                <div>
                  <h2>本月成本 Top 订阅</h2>
                  <p>先看哪几个工具是月成本主力，后面再决定要不要优化订阅结构。</p>
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>平台</th>
                      <th>周期</th>
                      <th>月成本</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.topSubscriptions.length ? (
                      overview.topSubscriptions.map((entry) => (
                        <tr key={`${entry.provider}-${entry.billingCycle}`}>
                          <td>{entry.provider}</td>
                          <td>{entry.billingCycle}</td>
                          <td>${entry.monthlyCost.toFixed(2)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3}>
                          <div className="empty-state">还没有有效订阅，先从常用工具开始录入月费或年费。</div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </article>
        </section>
      </section>

      <section className="workspace-section">
        <div className="workspace-section-head">
          <div>
            <p className="section-kicker">Workspace block</p>
            <h2>API 资产</h2>
            <p>这块专门回答 “我总共有哪些 API、分布在哪些平台、目前管理了多少把可用 Key”。</p>
          </div>
        </div>

        <section className="summary-card-grid">
          <article className="stat-card">
            <span className="stat-kicker">Tracked API keys</span>
            <strong className="stat-value">{overview.activeKeys}</strong>
            <p className="stat-note">当前仍处于可用状态的 API Key 数量。</p>
          </article>
          <article className="stat-card">
            <span className="stat-kicker">Tracked platforms</span>
            <strong className="stat-value">{overview.activeProviderCount}</strong>
            <p className="stat-note">当前订阅或密钥覆盖到的平台数量。</p>
          </article>
          <article className="stat-card">
            <span className="stat-kicker">Managed APIs</span>
            <strong className="stat-value">{overview.trackedApis.length}</strong>
            <p className="stat-note">当前已经在工作台中登记的平台/API 资产数。</p>
          </article>
        </section>

        <section className="grid cols-2">
          <article className="insight-card">
            <div className="section-head">
              <div>
                <h2>API 资产概览</h2>
                <p>这里聚焦的是你总共有哪些 API、分布在哪些平台，以及消耗数据目前是否已真正打通。</p>
              </div>
            </div>
            <div className="info-list">
              <div className="info-row">
                <span>已录入 API Keys</span>
                <strong>{overview.activeKeys}</strong>
              </div>
              <div className="info-row">
                <span>已接入平台</span>
                <strong>{overview.activeProviderCount}</strong>
              </div>
              <div className="info-row">
                <span>平台 / API 资产</span>
                <strong>{overview.trackedApis.length}</strong>
              </div>
            </div>
          </article>

          <article className="table-card">
            <div className="card">
              <div className="section-head">
                <div>
                  <h2>最近被查看 / 复制的 Key</h2>
                  <p>帮助你快速看到最近常用或刚刚被操作过的 API 资产，减少回忆成本。</p>
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Key</th>
                      <th>最近动作</th>
                      <th>时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.recentCredentialEvents.length ? (
                      overview.recentCredentialEvents.map((item) => (
                        <tr key={item.id}>
                          <td>
                            {item.provider} · {item.label}
                          </td>
                          <td>{item.lastActionType === "copied" ? "复制明文" : "查看明文"}</td>
                          <td>{item.lastActionAt?.toISOString().slice(0, 16).replace("T", " ")}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3}>
                          <div className="empty-state">还没有查看或复制记录。你复制或查看明文后，这里会自动出现最近活动。</div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </article>
        </section>

        <section className="grid cols-2">
          <article className="table-card">
            <div className="card">
              <div className="section-head">
                <div>
                  <h2>已管理的 API 平台</h2>
                  <p>这里按你已经录入的订阅和 API Key 汇总平台，帮助你快速确认资产范围。</p>
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>平台</th>
                      <th>状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.trackedApis.length ? (
                      overview.trackedApis.map((provider) => (
                        <tr key={provider}>
                          <td>{provider}</td>
                          <td>已录入</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={2}>
                          <div className="empty-state">还没有录入任何 API 平台，先从常用平台新增一把 Key。</div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </article>
        </section>
      </section>

      <section className="workspace-section">
        <div className="workspace-section-head">
          <div>
            <p className="section-kicker">Workspace block</p>
            <h2>数据接入状态</h2>
            <p>最后才看数据链路本身：现在有哪些统计已经可信，哪些还没打通，避免把占位数据当成真实结论。</p>
          </div>
        </div>

        <section className="grid cols-2">
          <article className="table-card">
            <div className="card">
              <div className="section-head">
                <div>
                  <h2>当前数据接入状态</h2>
                  <p>这张表专门说明哪些数据现在可以信，哪些还只是准备中的能力，避免控制台信息误导判断。</p>
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>项</th>
                      <th>说明</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>订阅月成本</td>
                      <td>可信，来自你手动维护的订阅台账。</td>
                    </tr>
                    <tr>
                      <td>API 平台列表</td>
                      <td>可信，来自已保存的订阅和 API Key。</td>
                    </tr>
                    <tr>
                      <td>项目使用情况</td>
                      <td>暂未打通，当前模型里还没有“项目到 API Key 再到消耗”的映射关系。</td>
                    </tr>
                    <tr>
                      <td>Token / 请求量</td>
                      <td>{hasTrustedUsage ? "已接入真实数据源，可作为参考。" : "尚未稳定接入真实数据源，当前不建议作为真实消耗判断。"}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </article>

          <article className="table-card">
            <div className="card">
              <div className="section-head">
                <div>
                  <h2>{hasTrustedUsage ? "最近使用的 API / 模型" : "API 使用现状"}</h2>
                  <p>
                    {hasTrustedUsage
                      ? "当 API 消耗已经接通时，这里可以帮助你判断哪些 Key 或模型正在使用。"
                      : "你现在还没有可信的 API 使用数据，所以这里先不显示 Token 排行，避免误导。"}
                  </p>
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{hasTrustedUsage ? "对象" : "状态"}</th>
                      <th>{hasTrustedUsage ? "统计" : "说明"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hasTrustedUsage
                      ? tokenStats.topCredentials.slice(0, 6).map((entry) => (
                          <tr key={entry.credentialId}>
                            <td>{entry.label}</td>
                            <td>{entry.totalTokens} tokens</td>
                          </tr>
                        ))
                      : [
                          <tr key="usage-status">
                            <td>同步状态</td>
                            <td>当前主要依赖订阅台账和密钥保险库，真实 API 消耗尚未稳定接入。</td>
                          </tr>,
                          <tr key="usage-next">
                            <td>下一步</td>
                            <td>接入真实 provider usage/billing API 后，再展示 Token、请求量和模型排行。</td>
                          </tr>,
                        ]}
                    {hasTrustedUsage && !tokenStats.topCredentials.length ? (
                      <tr>
                        <td colSpan={2}>
                          <div className="empty-state">已经接入真实同步，但还没有与具体 Key 关联的使用记录。</div>
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </article>
        </section>
      </section>
    </div>
  );
}
