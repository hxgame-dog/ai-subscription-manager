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
          <h1>密钥保险库</h1>
          <p>把可用 API Key 统一加密托管，避免散落在便签、浏览器和本地脚本里。</p>
        </div>
        <div className="hero-meta">
          <div className="meta-chip">
            Active keys <strong>{list.filter((item) => item.status === "ACTIVE").length}</strong>
          </div>
          <div className="meta-chip">
            Vault mode <strong>Encrypted</strong>
          </div>
        </div>
      </section>

      <div className="split-layout">
        <section className="card">
          <div className="section-head">
            <div>
              <h2>新增 API Key</h2>
              <p>保存后只展示脱敏信息，数据库里不会记录明文。</p>
            </div>
          </div>
          <CredentialForm providers={providers.map((p) => ({ id: p.id, name: p.name }))} />
        </section>

        <section className="table-card">
          <div className="card">
            <div className="section-head">
              <div>
                <h2>Key 列表</h2>
                <p>现在支持搜索、状态筛选和列表内一键复制，日常使用会顺手很多。</p>
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
