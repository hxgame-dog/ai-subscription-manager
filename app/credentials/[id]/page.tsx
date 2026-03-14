import Link from "next/link";
import { notFound } from "next/navigation";

import { CredentialSecretPanel } from "@/components/credential-secret-panel";
import { auth } from "@/lib/auth";
import { getCredentialUsageStats } from "@/lib/dashboard";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function CredentialDetailPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    return <div className="empty-state">请先登录后再查看密钥详情。</div>;
  }

  const { id } = await params;
  const data = await getCredentialUsageStats(session.user.id, id);
  if (!data) {
    notFound();
  }

  return (
    <div className="page-stack">
      <section className="page-hero">
        <div className="hero-copy">
          <h1>{data.credential.label}</h1>
          <p>查看这把 key 的平台归属、累计 Token、花费、模型分布以及敏感访问审计记录。</p>
        </div>
        <div className="hero-meta">
          <div className="meta-chip">
            Provider <strong>{data.credential.provider.name}</strong>
          </div>
          <div className="meta-chip">
            Status <strong>{data.credential.status}</strong>
          </div>
        </div>
      </section>

      <section className="grid cols-4">
        <article className="stat-card">
          <span className="stat-kicker">Requests</span>
          <strong className="stat-value">{data.totals.requests}</strong>
          <p className="stat-note">累计记录到的请求次数。</p>
        </article>
        <article className="stat-card">
          <span className="stat-kicker">Tokens</span>
          <strong className="stat-value">{data.totals.totalTokens}</strong>
          <p className="stat-note">输入与输出 Token 累计总和。</p>
        </article>
        <article className="stat-card">
          <span className="stat-kicker">Spend</span>
          <strong className="stat-value">${data.totals.spend.toFixed(4)}</strong>
          <p className="stat-note">累计费用估算（USD）。</p>
        </article>
        <article className="stat-card">
          <span className="stat-kicker">Errors</span>
          <strong className="stat-value">{data.totals.errors}</strong>
          <p className="stat-note">最近采样中的错误记录数。</p>
        </article>
      </section>

      <div className="split-layout">
        <section className="card">
          <div className="section-head">
            <div>
              <h2>密钥控制</h2>
              <p>明文查看与复制都会触发二次确认，并写入访问审计。</p>
            </div>
          </div>
          <div className="stack">
            <div className="metric-line">
              <span>指纹</span>
              <strong>{data.credential.fingerprint}</strong>
            </div>
            <div className="metric-line">
              <span>最近使用</span>
              <strong>{data.credential.lastUsedAt?.toISOString().slice(0, 19).replace("T", " ") ?? "-"}</strong>
            </div>
            <div className="metric-line">
              <span>最近查看</span>
              <strong>{data.credential.lastViewedAt?.toISOString().slice(0, 19).replace("T", " ") ?? "-"}</strong>
            </div>
            <div className="metric-line">
              <span>最近复制</span>
              <strong>{data.credential.lastCopiedAt?.toISOString().slice(0, 19).replace("T", " ") ?? "-"}</strong>
            </div>
            {data.credential.notes ? (
              <div className="empty-state">
                <strong>备注</strong>
                <div>{data.credential.notes}</div>
              </div>
            ) : null}
          </div>
          <CredentialSecretPanel
            credentialId={data.credential.id}
            visibilityLevel={data.credential.visibilityLevel}
          />
        </section>

        <div className="stack">
          <section className="card">
            <div className="section-head">
              <div>
                <h2>模型使用</h2>
                <p>快速查看这把 key 实际涉及了哪些模型。</p>
              </div>
            </div>
            {data.models.length ? (
              <div className="tag-list">
                {data.models.map((model) => (
                  <span className="badge info" key={model}>
                    {model}
                  </span>
                ))}
              </div>
            ) : (
              <div className="empty-state">还没有模型使用记录。</div>
            )}
          </section>

          <section className="table-card">
            <div className="card">
              <div className="section-head">
                <div>
                  <h2>最近使用</h2>
                  <p>最近 10 条使用与费用记录，便于快速排查异常。</p>
                </div>
                <Link href="/credentials">返回保险库</Link>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>时间</th>
                    <th>模型</th>
                    <th>请求</th>
                    <th>Total Tokens</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {data.latestUsage.map((row) => (
                    <tr key={row.id}>
                      <td>{row.recordedAt.toISOString().slice(0, 19).replace("T", " ")}</td>
                      <td>{row.providerModel ?? row.model ?? "-"}</td>
                      <td>{row.requestCount}</td>
                      <td>{row.inputTokens + row.outputTokens}</td>
                      <td>
                        <span className={`badge ${row.errorType ? "danger" : "success"}`}>
                          {row.errorType ?? "OK"}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!data.latestUsage.length ? (
                    <tr>
                      <td colSpan={5}>
                        <div className="empty-state">还没有使用记录，先触发一次同步再回来查看。</div>
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
