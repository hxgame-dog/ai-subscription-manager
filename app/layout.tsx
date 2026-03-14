import type { Metadata } from "next";
import Link from "next/link";

import { auth } from "@/lib/auth";
import "./styles.css";

export const metadata: Metadata = {
  title: "AI Subscription Manager",
  description: "Manage AI subscriptions, keys, and usage in one place.",
};

const nav = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/subscriptions", label: "Subscriptions" },
  { href: "/credentials", label: "API Keys" },
  { href: "/alerts", label: "Alerts" },
  { href: "/usage", label: "Usage Sync" },
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <html lang="zh-CN">
      <body>
        <div className="shell">
          <aside className="sidebar">
            <h1>AI Plan Manager</h1>
            <p>Vercel + Neon</p>
            <nav>
              {nav.map((item) => (
                <Link key={item.href} href={item.href} className="nav-item">
                  {item.label}
                </Link>
              ))}
            </nav>
            <div style={{ marginTop: 20 }}>
              {session?.user ? (
                <a className="nav-item" href="/api/auth/signout">
                  Sign out
                </a>
              ) : (
                <a className="nav-item" href="/api/auth/signin">
                  Sign in with Google
                </a>
              )}
            </div>
          </aside>
          <main className="content">{children}</main>
        </div>
      </body>
    </html>
  );
}
