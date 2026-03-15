"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type NavItem = {
  href: string;
  label: string;
  sublabel: string;
  icon: ReactNode;
  tone: "dashboard" | "subscriptions" | "vault" | "alerts" | "sync";
};

export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav>
      {items.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-item nav-tone-${item.tone}${isActive ? " nav-item-active" : ""}`}
            aria-current={isActive ? "page" : undefined}
          >
            <span className="nav-main">
              {item.icon}
              <span className="nav-label">{item.label}</span>
            </span>
            <span className="nav-sublabel">{item.sublabel}</span>
          </Link>
        );
      })}
    </nav>
  );
}
