"use client";

import Link from "next/link";
import {
  Activity, Bell, Bot, ChevronDown, ChevronLeft, ChevronRight,
  CircleGauge, Command, LayoutDashboard, Menu, Package, Settings, Wrench,
  ShieldCheck, Swords, Ticket, X,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useState, type ReactNode } from "react";

const groups = [
  { title: "GENERAL", items: [
    { label: "Dashboard", href: "/", icon: LayoutDashboard },
    { label: "Serverübersicht", href: "/servers", icon: CircleGauge },
    { label: "Aktivitäten", href: "/logs", icon: Activity },
    { label: "Analytics", href: "/analytics", icon: Activity },
  ]},
  { title: "COMMUNITY", items: [
    { label: "Clans", href: "/clans", icon: Swords },
    { label: "Preislisten", href: "/prices", icon: Package },
  ]},
  { title: "UNTERSTÜTZUNG", items: [
    { label: "Tickets", href: "/tickets", icon: Ticket },
    { label: "Moderation", href: "/moderation", icon: ShieldCheck },
  ]},
  { title: "BOT SYSTEM", items: [
    { label: "Werkzeuge", href: "/tools", icon: Wrench },
    { label: "Bot Status", href: "/bot-status", icon: Bot },
    { label: "Commands", href: "/commands", icon: Command },
    { label: "Einstellungen", href: "/settings", icon: Settings },
  ]},
];

export function DashboardShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: session, status } = useSession();

  if (status !== "authenticated") return children;

  return (
    <div className="min-h-screen bg-[#090b10] text-slate-100">
      {mobileOpen && (
        <button className="fixed inset-0 z-40 bg-black/60 lg:hidden" aria-label="Navigation schließen" onClick={() => setMobileOpen(false)} />
      )}
      <aside className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-white/[0.06] bg-[#0d1017] transition-all duration-300 ${collapsed ? "w-[78px]" : "w-[248px]"} ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="flex h-16 items-center border-b border-white/[0.06] px-5">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-600 text-sm font-bold shadow-lg shadow-violet-950/40">CH</div>
          {!collapsed && <div className="ml-3"><p className="text-sm font-semibold">Control Hub</p><p className="text-[11px] text-slate-500">Discord Administration</p></div>}
          <button className="ml-auto lg:hidden" onClick={() => setMobileOpen(false)}><X size={18} /></button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-5">
          {groups.map((group) => (
            <div key={group.title}>
              {!collapsed && <p className="mb-2 px-3 text-[10px] font-bold tracking-[0.16em] text-slate-600">{group.title}</p>}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.href} href={item.href} title={collapsed ? item.label : undefined} onClick={() => setMobileOpen(false)}
                      className={`flex h-10 items-center rounded-lg px-3 text-sm transition ${"text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"} ${collapsed ? "justify-center" : ""}`}>
                      <Icon size={17} />
                      {!collapsed && <span className="ml-3">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <button onClick={() => setCollapsed((value) => !value)} className="hidden h-12 items-center justify-center border-t border-white/[0.06] text-slate-500 hover:text-slate-200 lg:flex">
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </aside>

      <div className={`transition-all ${collapsed ? "lg:ml-[78px]" : "lg:ml-[248px]"}`}>
        <header className="sticky top-0 z-30 flex h-16 items-center border-b border-white/[0.06] bg-[#090b10]/90 px-4 backdrop-blur-xl sm:px-6">
          <button className="mr-3 text-slate-400 lg:hidden" onClick={() => setMobileOpen(true)}><Menu size={20} /></button>
          <button className="hidden h-9 w-full max-w-sm items-center rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 text-left text-sm text-slate-600 sm:flex">
            <span>Globale Suche...</span><span className="ml-auto rounded border border-white/[0.08] px-1.5 py-0.5 text-[10px]">⌘ K</span>
          </button>
          <div className="ml-auto flex items-center gap-2">
            <button className="relative grid h-9 w-9 place-items-center rounded-lg border border-white/[0.07] text-slate-400 hover:bg-white/[0.04]"><Bell size={17} /><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-violet-500" /></button>
            <button
              className="flex h-9 items-center gap-2 rounded-lg border border-white/[0.07] px-2 text-sm hover:bg-white/[0.04]"
              onClick={() => signOut({ redirectTo: "/login" })}
              title="Abmelden"
            >
              <span className="grid h-6 w-6 place-items-center rounded-md bg-violet-700 text-[10px] font-semibold">
                {(session?.user?.name || "DC").slice(0, 2).toUpperCase()}
              </span>
              <span className="hidden max-w-32 truncate sm:block">{session?.user?.name || "Discord-Nutzer"}</span>
              <ChevronDown size={14} className="hidden text-slate-500 sm:block" />
            </button>
          </div>
        </header>
        <main className="mx-auto max-w-[1600px] p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
