import { CredentialForm } from "@/components/credential-form";
import { CredentialVaultTable } from "@/components/credential-vault-table";
import { auth } from "@/lib/auth";
import { decryptSecret, maskSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { ensureProviders } from "@/lib/providers";

export default async function CredentialsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return <div className="empty-state">请先登录后再查看密钥保险库。</div>;
  }

  await ensureProviders();

  const [providers, list] = await Promise.all([
    prisma.provider.findMany({ orderBy: { name: "asc" } }),
    prisma.apiCredential.findMany({
      where: { userId: session.user.id },
      include: { provider: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="page-stack">
      <section className="page-hero">
        <div className="hero-copy">
          <p className="section-kicker">Vault</p>
          <h1>密钥保险库</h1>
          <p>把常用 API Key 放到一个固定位置。录入时有上下文，复制时有审计，查找时不需要翻脚本和便签。</p>
        </div>
        <div className="hero-meta">
          <div className="meta-chip">
            Active keys <strong>{list.filter((item) => item.status === "ACTIVE").length}</strong>
          </div>
          <div className="meta-chip">
            Last added <strong>{list[0]?.provider.name ?? "No records"}</strong>
          </div>
        </div>
      </section>

      <div className="stack-layout">
        <section className="card form-panel">
          <div className="section-head">
              <div>
                <h2>新增 API Key</h2>
                <p>保存后默认只展示脱敏信息。需要查看或复制明文时，再做一次确认。</p>
              </div>
            </div>
          <CredentialForm providers={providers.map((p) => ({ id: p.id, name: p.name }))} />
        </section>

        <section className="table-card">
          <div className="table-section">
            <div className="section-head">
              <div>
                <h2>Key 列表</h2>
                <p>更像数据库表格来使用它：搜索、筛选、查看详情、快速复制，主次会更清楚。</p>
              </div>
            </div>
          </div>
          <CredentialVaultTable
            items={list.map((item) => ({
              id: item.id,
              provider: item.provider.name,
              providerKey: item.provider.key,
              label: item.label,
              notes: item.notes,
              fingerprint: item.fingerprint,
              maskedValue: maskSecret(decryptSecret(item)),
              status: item.status,
              lastUsedAt: item.lastUsedAt?.toISOString() ?? null,
            }))}
          />
        </section>
      </div>
    </div>
  );
}
