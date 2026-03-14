import { CredentialForm } from "@/components/credential-form";
import { auth } from "@/lib/auth";
import { maskSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { ensureProviders } from "@/lib/providers";

export default async function CredentialsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return <div className="card">请先登录。</div>;
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
    <div className="grid">
      <section className="card">
        <h2>新增 API Key（加密存储）</h2>
        <CredentialForm providers={providers.map((p) => ({ id: p.id, name: p.name }))} />
      </section>

      <section>
        <h2>Key 保险库</h2>
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
                <td>{item.provider.name}</td>
                <td>{item.label}</td>
                <td>{item.fingerprint}</td>
                <td>{maskSecret(item.fingerprint)}</td>
                <td>{item.status}</td>
              </tr>
            ))}
            {list.length === 0 ? (
              <tr>
                <td colSpan={5}>暂无数据</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
