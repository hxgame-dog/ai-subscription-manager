import { AlertRuleForm } from "@/components/alert-rule-form";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureProviders } from "@/lib/providers";

export default async function AlertsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return <div className="empty-state">请先登录后再管理提醒规则。</div>;
  }

  await ensureProviders();

  const [providers, rules, events] = await Promise.all([
    prisma.provider.findMany({ orderBy: { name: "asc" } }),
    prisma.alertRule.findMany({ where: { userId: session.user.id }, orderBy: { createdAt: "desc" } }),
    prisma.alertEvent.findMany({ where: { userId: session.user.id }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);

  return (
    <div className="page-stack">
      <section className="page-hero">
        <div className="hero-copy">
          <p className="section-kicker">Alerts</p>
          <h1>提醒中心</h1>
          <p>把额度阈值和续费提醒放到一个位置维护。这里的目标很简单：在问题发生前先收到提醒，而不是事后发现。</p>
        </div>
        <div className="hero-meta">
          <div className="meta-chip">
            Rules <strong>{rules.length}</strong>
          </div>
          <div className="meta-chip">
            Latest event <strong>{events[0] ? events[0].createdAt.toISOString().slice(5, 10) : "None"}</strong>
          </div>
        </div>
      </section>

      <div className="split-layout">
        <section className="card">
          <div className="section-head">
            <div>
              <h2>新增提醒规则</h2>
              <p>先用少量规则覆盖最常见的问题，再慢慢扩展细分场景。</p>
            </div>
          </div>
          <AlertRuleForm providers={providers.map((p) => ({ id: p.id, name: p.name }))} />
        </section>

        <div className="stack">
          <section className="table-card">
            <div className="table-section">
              <div className="section-head">
                <div>
                  <h2>规则列表</h2>
                  <p>保持规则少而明确，让你知道哪些平台会触发、会走哪些渠道。</p>
                </div>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>类型</th>
                    <th>阈值</th>
                    <th>提前天数</th>
                    <th>渠道</th>
                    <th>启用</th>
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
                          {r.isEnabled ? "Enabled" : "Disabled"}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {rules.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        <div className="empty-state">还没有提醒规则，建议先配一个 80% 用量阈值告警。</div>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="table-card">
            <div className="table-section">
              <div className="section-head">
                <div>
                  <h2>最近告警事件</h2>
                  <p>先看站内事件是否正常生成，后面再接真实邮件提醒。</p>
                </div>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>时间</th>
                    <th>类型</th>
                    <th>渠道</th>
                    <th>标题</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e) => (
                    <tr key={e.id}>
                      <td>{e.createdAt.toISOString().slice(0, 19).replace("T", " ")}</td>
                      <td>{e.type}</td>
                      <td>{e.channel}</td>
                      <td>{e.title}</td>
                    </tr>
                  ))}
                  {events.length === 0 ? (
                    <tr>
                      <td colSpan={4}>
                        <div className="empty-state">还没有触发记录。先同步一次数据，再观察提醒是否生成。</div>
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
