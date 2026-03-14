import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureProviders } from "@/lib/providers";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return <div className="card">请先登录（配置 Google OAuth 后可用）。</div>;
  }

  await ensureProviders();

  const [subCount, credCount, syncCount, spend] = await Promise.all([
    prisma.subscription.count({ where: { userId: session.user.id, isActive: true } }),
    prisma.apiCredential.count({ where: { userId: session.user.id, status: "ACTIVE" } }),
    prisma.syncJob.count({ where: { userId: session.user.id } }),
    prisma.spendRecord.aggregate({ where: { userId: session.user.id }, _sum: { amount: true } }),
  ]);

  return (
    <div className="grid cols-3">
      <section className="card">
        <h2>激活订阅</h2>
        <strong>{subCount}</strong>
      </section>
      <section className="card">
        <h2>激活 API Key</h2>
        <strong>{credCount}</strong>
      </section>
      <section className="card">
        <h2>累计同步任务</h2>
        <strong>{syncCount}</strong>
      </section>
      <section className="card">
        <h2>累计花费 (USD)</h2>
        <strong>{Number(spend._sum.amount || 0).toFixed(4)}</strong>
      </section>
    </div>
  );
}
