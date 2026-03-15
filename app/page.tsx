import Link from "next/link";

import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { auth } from "@/lib/auth";

export default async function Home() {
  const session = await auth();

  return (
    <div className="page-stack">
      <section className="page-hero">
        <div className="hero-copy">
          <h1>AI 资产控制台</h1>
          <p>
            把你的 AI 平台订阅、API Key、同步记录和费用视图集中到一个入口，让个人工作流先从“可管、可找、可复制”开始。
          </p>
        </div>
        <div className="hero-meta">
          <div className="meta-chip">
            Product mode <strong>MVP Online</strong>
          </div>
          <div className="meta-chip">
            Login <strong>Google OAuth</strong>
          </div>
        </div>
      </section>

      <section className="card landing-card">
        <div className="section-head">
          <div>
            <h2>{session?.user ? "欢迎回来" : "开始使用"}</h2>
            <p>
              {session?.user
                ? "你已经完成登录，现在可以直接进入控制台查看订阅、密钥保险库和同步数据。"
                : "建议直接使用 Google 登录，然后从保险库开始录入常用平台 Key，把 AI 资产先收拢起来。"}
            </p>
          </div>
        </div>

        <div className="cta-row">
          {session?.user ? (
            <Link href="/dashboard" className="cta-button primary">
              进入控制台
            </Link>
          ) : (
            <GoogleSignInButton className="cta-button primary" label="使用 Google 登录" />
          )}
          <Link href="/dashboard" className="cta-button secondary">
            查看 Dashboard
          </Link>
        </div>
        <div className="grid cols-3 landing-metrics">
          <article className="soft-card">
            <strong>统一管理</strong>
            <span>订阅、Key、同步记录放在同一处。</span>
          </article>
          <article className="soft-card">
            <strong>快速复制</strong>
            <span>常用 Key 可直接从保险库详情或列表复制。</span>
          </article>
          <article className="soft-card">
            <strong>逐步升级</strong>
            <span>先录入和管理，再慢慢接自动统计与监控。</span>
          </article>
        </div>
      </section>
    </div>
  );
}
