"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileSearch, History, Settings, Home } from "lucide-react";

const navItems = [
  { href: "/", label: "New Review", icon: Home },
  { href: "/history", label: "History", icon: History },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 bg-[var(--sidebar-bg)] text-[var(--sidebar-text)] flex flex-col">
      <div className="p-4 border-b border-white/10">
        <Link href="/" className="flex items-center gap-2 text-white font-semibold text-lg">
          <FileSearch className="w-5 h-5" />
          Makora
        </Link>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? "bg-white/15 text-white"
                  : "hover:bg-white/10 text-[var(--sidebar-text)]"
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
