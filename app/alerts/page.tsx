import { AlertRuleForm } from "@/components/alert-rule-form";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureProviders } from "@/lib/providers";

export default async function AlertsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return <div className="card">请先登录。</div>;
  }

  await ensureProviders();

  const [providers, rules, events] = await Promise.all([
    prisma.provider.findMany({ orderBy: { name: "asc" } }),
    prisma.alertRule.findMany({ where: { userId: session.user.id }, orderBy: { createdAt: "desc" } }),
    prisma.alertEvent.findMany({ where: { userId: session.user.id }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);

  return (
    <div className="grid">
      <section className="card">
        <h2>新增提醒规则</h2>
        <AlertRuleForm providers={providers.map((p) => ({ id: p.id, name: p.name }))} />
      </section>

      <section>
        <h2>规则列表</h2>
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
                <td>{r.isEnabled ? "YES" : "NO"}</td>
              </tr>
            ))}
            {rules.length === 0 ? (
              <tr>
                <td colSpan={5}>暂无规则</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section>
        <h2>最近告警事件</h2>
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
                <td colSpan={4}>暂无事件</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
