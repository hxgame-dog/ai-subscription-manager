import { SubscriptionForm } from "@/components/subscription-form";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureProviders } from "@/lib/providers";

export default async function SubscriptionsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return <div className="card">请先登录。</div>;
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
    <div className="grid">
      <section className="card">
        <h2>新增订阅</h2>
        <SubscriptionForm providers={providers.map((p) => ({ id: p.id, name: p.name }))} />
      </section>

      <section>
        <h2>订阅列表</h2>
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
                <td>{item.provider.name}</td>
                <td>{item.planName}</td>
                <td>{item.billingCycle}</td>
                <td>
                  {item.currency} {item.price.toString()}
                </td>
                <td>{item.renewalDate.toISOString().slice(0, 10)}</td>
                <td>{item.isActive ? "ACTIVE" : "INACTIVE"}</td>
              </tr>
            ))}
            {list.length === 0 ? (
              <tr>
                <td colSpan={6}>暂无数据</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
