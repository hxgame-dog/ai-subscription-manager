import Link from "next/link";

import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { auth } from "@/lib/auth";

export default async function Home() {
  const session = await auth();

  return (
    <div className="page-stack">
      <section className="page-hero">
        <div className="hero-copy">
          <p className="section-kicker">AI asset workspace</p>
          <h1>AI 资产控制台</h1>
          <p>
            把你的 AI 平台订阅、API Key、同步记录和费用视图集中到一个入口。先把常用资产收拢，再慢慢补齐监控、统计和提醒。
          </p>
        </div>
        <div className="hero-meta">
          <div className="meta-chip">
            Workspace <strong>Personal ops</strong>
          </div>
          <div className="meta-chip">
            Entry <strong>{session?.user ? "Dashboard" : "Google OAuth"}</strong>
          </div>
        </div>
      </section>

      <section className="landing-grid">
        <article className="card landing-card">
          <div className="landing-lead">
            <div>
              <p className="section-kicker">Start here</p>
              <h2>{session?.user ? "欢迎回来" : "先从登录开始"}</h2>
              <p>
                {session?.user
                  ? "你已经完成登录，现在可以继续整理订阅、保存 Key，或者查看最近的同步和费用变化。"
                  : "建议先使用 Google 登录，然后从密钥保险库开始，逐步把常用平台的账号、订阅和调用入口放到同一处。"}
              </p>
            </div>

            <div className="cta-row">
              {session?.user ? (
                <Link href="/dashboard" className="cta-button primary">
                  进入控制台
                </Link>
              ) : (
                <GoogleSignInButton className="cta-button primary" label="使用 Google 登录" />
              )}
              <Link href="/credentials" className="cta-button secondary">
                查看密钥保险库
              </Link>
            </div>
          </div>
        </article>

        <article className="card landing-card">
          <div className="section-head">
            <div>
              <p className="section-kicker">How it works</p>
              <h2>像工作台一样使用它</h2>
              <p>不是一次性填表，而是把经常会回来看、会复制、会对比的信息放到固定位置。</p>
            </div>
          </div>
          <div className="stack landing-metrics">
            <article className="soft-card">
              <strong>管理订阅</strong>
              <span>统一记录套餐、价格、周期和续费日。</span>
            </article>
            <article className="soft-card">
              <strong>保存密钥</strong>
              <span>常用平台 Key 集中存放，方便查看与复制。</span>
            </article>
            <article className="soft-card">
              <strong>查看用量</strong>
              <span>同步记录、费用趋势和关键资产逐步收敛到同一面板。</span>
            </article>
          </div>
        </article>
      </section>

      <section className="grid cols-3 landing-metrics">
          <article className="soft-card">
            <strong>统一管理</strong>
            <span>把散落的平台账号、订阅和 Key 整理成一张自己的 AI 资产台账。</span>
          </article>
          <article className="soft-card">
            <strong>快速复制</strong>
            <span>日常使用时，优先保证搜索、查看、复制这些动作足够顺手。</span>
          </article>
          <article className="soft-card">
            <strong>逐步升级</strong>
            <span>先把数据收拢起来，再逐步接自动统计、监控和提醒。</span>
          </article>
      </section>
    </div>
  );
}
