import type { Metadata } from "next";
import Link from "next/link";

import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { auth } from "@/lib/auth";
import "./styles.css";

export const metadata: Metadata = {
  title: "AI Subscription Manager",
  description: "Manage AI subscriptions, keys, and usage in a calm workspace.",
};

const nav = [
  { href: "/dashboard", label: "控制台", sublabel: "Dashboard" },
  { href: "/subscriptions", label: "订阅管理", sublabel: "Subscriptions" },
  { href: "/credentials", label: "密钥保险库", sublabel: "API Keys" },
  { href: "/alerts", label: "提醒中心", sublabel: "Alerts" },
  { href: "/usage", label: "同步记录", sublabel: "Usage Sync" },
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <html lang="zh-CN">
      <body>
        <div className="shell">
          <aside className="sidebar">
            <div className="brand-block">
              <span className="brand-chip">AI Workspace</span>
              <h1>订阅总控台</h1>
              <p>Subscriptions, spend, keys, and sync notes in one quiet workspace.</p>
            </div>
            <div className="page-block">
              <p className="section-kicker">Navigation</p>
              <p>优先把平台、订阅、密钥和同步放在固定位置，减少切换成本。</p>
            </div>
            <nav>
              {nav.map((item) => (
                <Link key={item.href} href={item.href} className="nav-item">
                  <span className="nav-label">{item.label}</span>
                  <span className="nav-sublabel">{item.sublabel}</span>
                </Link>
              ))}
            </nav>
            <div className="auth-link-wrap">
              {session?.user ? (
                <a className="nav-item" href="/api/auth/signout">
                  <span className="nav-label">退出登录</span>
                  <span className="nav-sublabel">Sign Out</span>
                </a>
              ) : (
                <GoogleSignInButton
                  className="nav-item nav-button"
                  label="Google 登录"
                  sublabel="Sign In With Google"
                />
              )}
            </div>
          </aside>
          <main className="content">{children}</main>
        </div>
      </body>
    </html>
  );
}
