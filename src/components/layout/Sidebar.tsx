"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { History, Settings, Home, Brain } from "lucide-react";

function MakoraLogo({ className }: { className?: string }) {
  const cx = 12, cy = 12, hub = 2, rim = 7.5, orbDist = 10, orb = 1.5;
  const points = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    return {
      hx: cx + hub * Math.cos(a), hy: cy - hub * Math.sin(a),
      rx: cx + rim * Math.cos(a), ry: cy - rim * Math.sin(a),
      ox: cx + orbDist * Math.cos(a), oy: cy - orbDist * Math.sin(a),
    };
  });

  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx={cx} cy={cy} r={rim} stroke="currentColor" strokeWidth="1.2" fill="none" />
      <circle cx={cx} cy={cy} r={hub} stroke="currentColor" strokeWidth="1.2" fill="currentColor" fillOpacity="0.3" />
      {points.map((p, i) => (
        <g key={i}>
          <line x1={p.hx} y1={p.hy} x2={p.ox} y2={p.oy} stroke="currentColor" strokeWidth="1.1" />
          <circle cx={p.ox} cy={p.oy} r={orb} stroke="currentColor" strokeWidth="0.8" fill="currentColor" fillOpacity="0.2" />
        </g>
      ))}
    </svg>
  );
}

const navItems = [
  { href: "/", label: "New Review", icon: Home },
  { href: "/history", label: "History", icon: History },
  { href: "/rules", label: "Rules", icon: Brain },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 bg-[var(--sidebar-bg)] text-[var(--sidebar-text)] flex flex-col">
      <div className="p-4 border-b border-white/10">
        <Link href="/" className="flex items-center gap-2 text-white text-xl">
          <MakoraLogo className="w-8 h-8" />
          <span className="font-[family-name:var(--font-righteous)] tracking-wide">Makora</span>
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
