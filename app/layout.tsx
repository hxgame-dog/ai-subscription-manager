import type { Metadata } from "next";

import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { SidebarNav } from "@/components/sidebar-nav";
import { auth } from "@/lib/auth";
import "./styles.css";

export const metadata: Metadata = {
  title: "AI Subscription Manager",
  description: "Manage AI subscriptions, keys, and usage in a calm workspace.",
};

const nav = [
  { href: "/dashboard", label: "控制台", sublabel: "Dashboard", icon: "dashboard" },
  { href: "/subscriptions", label: "订阅管理", sublabel: "Subscriptions", icon: "subscriptions" },
  { href: "/credentials", label: "密钥保险库", sublabel: "API Keys", icon: "keys" },
  { href: "/alerts", label: "提醒中心", sublabel: "Alerts", icon: "alerts" },
  { href: "/usage", label: "同步记录", sublabel: "Usage Sync", icon: "sync" },
];

function NavIcon({ kind }: { kind: string }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.7,
    viewBox: "0 0 24 24",
  };

  if (kind === "dashboard") {
    return (
      <svg aria-hidden="true" className="nav-icon" {...common}>
        <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
        <rect x="13.5" y="3.5" width="7" height="4.5" rx="1.5" />
        <rect x="13.5" y="11.5" width="7" height="9" rx="1.5" />
        <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      </svg>
    );
  }

  if (kind === "subscriptions") {
    return (
      <svg aria-hidden="true" className="nav-icon" {...common}>
        <path d="M4 7.5h16" />
        <path d="M4 12h16" />
        <path d="M4 16.5h10" />
        <rect x="3.5" y="4" width="17" height="16" rx="2" />
      </svg>
    );
  }

  if (kind === "keys") {
    return (
      <svg aria-hidden="true" className="nav-icon" {...common}>
        <circle cx="8.5" cy="11.5" r="3.5" />
        <path d="M12 11.5h8" />
        <path d="M17 11.5v3" />
        <path d="M20 11.5v2" />
      </svg>
    );
  }

  if (kind === "alerts") {
    return (
      <svg aria-hidden="true" className="nav-icon" {...common}>
        <path d="M12 4.5a4 4 0 0 0-4 4v2.1c0 .5-.2 1-.5 1.4L6 14.5h12l-1.5-2.5c-.3-.4-.5-.9-.5-1.4V8.5a4 4 0 0 0-4-4Z" />
        <path d="M10 18.5a2.3 2.3 0 0 0 4 0" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className="nav-icon" {...common}>
      <path d="M6 8a6 6 0 0 1 10.2-4.2" />
      <path d="M18 16a6 6 0 0 1-10.2 4.2" />
      <path d="M16 3.5v4h-4" />
      <path d="M8 20.5v-4h4" />
    </svg>
  );
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <html lang="zh-CN">
      <body>
        <div className="shell">
          <aside className="sidebar">
            <div className="brand-block">
              <h1>AI WORKSPACE</h1>
            </div>
            <div className="page-block">
              <p className="section-kicker">Navigation</p>
              <p>优先把平台、订阅、密钥和同步放在固定位置，减少切换成本。</p>
            </div>
            <SidebarNav
              items={nav.map((item) => ({
                ...item,
                tone:
                  item.icon === "dashboard"
                    ? "dashboard"
                    : item.icon === "subscriptions"
                      ? "subscriptions"
                      : item.icon === "keys"
                        ? "vault"
                        : item.icon === "alerts"
                          ? "alerts"
                          : "sync",
                icon: <NavIcon kind={item.icon} />,
              }))}
            />
            <div className="auth-link-wrap">
              {session?.user ? (
                <a className="nav-item" href="/api/auth/signout">
                  <span className="nav-main">
                    <NavIcon kind="logout" />
                    <span className="nav-label">退出登录</span>
                  </span>
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
