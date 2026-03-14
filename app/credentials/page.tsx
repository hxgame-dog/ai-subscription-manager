import { CredentialForm } from "@/components/credential-form";
import { auth } from "@/lib/auth";
import { maskSecret } from "@/lib/crypto";
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
                <p>优先保证状态清晰，便于之后接入轮换、禁用和审计能力。</p>
              </div>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>平台</th>
                  <th>标签</th>
                  <th>指纹</th>
                  <th>脱敏展示</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {list.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="cell-title">
                        <strong>{item.provider.name}</strong>
                        <span className="cell-subtitle">{item.provider.key}</span>
                      </div>
                    </td>
                    <td>{item.label}</td>
                    <td>{item.fingerprint}</td>
                    <td>{maskSecret(item.fingerprint)}</td>
                    <td>
                      <span
                        className={`badge ${
                          item.status === "ACTIVE" ? "success" : item.status === "DISABLED" ? "warning" : "info"
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {list.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <div className="empty-state">还没有密钥记录。先加一条测试 key，后面再接真实调用和轮换。</div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
