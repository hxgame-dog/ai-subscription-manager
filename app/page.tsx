import Link from "next/link";

import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { auth } from "@/lib/auth";

export default async function Home() {
  const session = await auth();

  return (
    <div className="page-stack">
      <section className="page-hero">
        <div className="hero-copy">
          <h1>AI Subscription Manager</h1>
          <p>
            集中管理 AI 订阅、API Key、用量与费用，把零散的平台账号变成一套清晰的个人 AI 资产面板。
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
                ? "你已经完成登录，可以直接进入控制台查看订阅、密钥和同步记录。"
                : "建议直接使用 Google 登录，这会把你带到授权页，然后自动回到控制台。"}
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
      </section>
    </div>
  );
}
