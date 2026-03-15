import { SubscriptionForm } from "@/components/subscription-form";
import { SubscriptionTable } from "@/components/subscription-table";
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
      <section className="page-hero page-hero-subscriptions">
        <div className="hero-copy">
          <p className="section-kicker">Subscriptions</p>
          <h1>订阅管理</h1>
          <p>把固定成本整理成一张持续维护的台账。重点看套餐、金额、周期和续费时间，而不是零散截图和账单邮件。</p>
        </div>
        <div className="hero-meta">
          <div className="meta-chip">
            Active plans <strong>{list.filter((item) => item.isActive).length}</strong>
          </div>
          <div className="meta-chip">
            Next renewal <strong>{list[0]?.renewalDate.toISOString().slice(0, 10) ?? "None"}</strong>
          </div>
        </div>
      </section>

      <div className="stack-layout">
        <section className="card form-panel panel-subscriptions">
          <div className="section-head">
            <div>
              <h2>新增订阅</h2>
              <p>优先把周期、价格和续费日录准，后面做提醒和成本对比才会稳定。</p>
            </div>
          </div>
          <SubscriptionForm providers={providers.map((p) => ({ id: p.id, name: p.name }))} />
        </section>

        <section className="table-card panel-subscriptions">
          <div className="table-section">
            <div className="section-head">
              <div>
                <h2>订阅列表</h2>
                <p>把它当台账来看：哪些工具在持续付费，哪些项目快续费，哪些应该暂停。</p>
              </div>
            </div>
          </div>
          <SubscriptionTable
            items={list.map((item) => ({
              id: item.id,
              providerId: item.providerId,
              provider: item.provider.name,
              providerKey: item.provider.key,
              planName: item.planName,
              billingCycle: item.billingCycle,
              price: item.price.toString(),
              currency: item.currency,
              renewalDate: item.renewalDate.toISOString().slice(0, 10),
              notes: item.notes,
              isActive: item.isActive,
            }))}
            providers={providers.map((p) => ({ id: p.id, name: p.name }))}
          />
        </section>
      </div>
    </div>
  );
}
