"use client";

import { useEffect, useState } from "react";
import { Activity, Bot, Database, RefreshCw, Server, Wifi } from "lucide-react";

type Status = {
  configured: boolean;
  botOnline: boolean;
  botState: string;
  botName: string | null;
  botGuildCount: number;
  database: string;
  guildCount: number;
  memberCount: number;
  lastSeenAt: string | null;
};

export default function BotStatusPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch("/api/status", { cache: "no-store" });
        if (!response.ok) throw new Error("Status konnte nicht geladen werden.");
        const data = await response.json() as Status;
        if (active) {
          setStatus(data);
          setError("");
          setUpdatedAt(new Date());
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Status konnte nicht geladen werden.");
      }
    };
    void refresh();
    const interval = setInterval(() => void refresh(), 10_000);
    return () => { active = false; clearInterval(interval); };
  }, []);

  const cards = [
    { label: "Gateway", value: status?.botOnline ? "Verbunden" : status?.botState || "Offline", icon: Wifi, tone: status?.botOnline ? "text-emerald-300 bg-emerald-400/10" : "text-amber-300 bg-amber-400/10" },
    { label: "Datenbank", value: status?.database === "connected" ? "Verbunden" : "Nicht erreichbar", icon: Database, tone: "text-cyan-300 bg-cyan-400/10" },
    { label: "Discord-Server", value: status?.botGuildCount ?? "—", icon: Server, tone: "text-violet-300 bg-violet-400/10" },
    { label: "Mitglieder", value: status?.memberCount ?? "—", icon: Activity, tone: "text-fuchsia-300 bg-fuchsia-400/10" },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section className="flex flex-col gap-4 rounded-2xl border border-white/[0.06] bg-[#11151d] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7"><div><div className="mb-2 inline-flex items-center gap-2 text-xs font-semibold tracking-widest text-violet-300"><Bot size={14} /> SYSTEM MONITOR</div><h1 className="text-2xl font-semibold text-white">Bot-Status</h1><p className="mt-2 text-sm text-slate-500">{status?.botName || "Discord Gateway und Datenbankverbindung"}</p></div><div className="inline-flex items-center gap-2 self-start rounded-lg border border-white/[0.07] px-3 py-2 text-xs text-slate-500 sm:self-auto"><RefreshCw size={13} className="animate-spin" /> Auto-Refresh · 10s</div></section>
      {error && <div role="alert" className="rounded-xl border border-rose-500/20 bg-rose-500/[0.07] px-4 py-3 text-sm text-rose-200">{error}</div>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map((card) => { const Icon = card.icon; return <div key={card.label} className="rounded-xl border border-white/[0.06] bg-[#11151d] p-4"><div className="flex items-center justify-between"><p className="text-sm text-slate-400">{card.label}</p><span className={`grid h-9 w-9 place-items-center rounded-lg ${card.tone}`}><Icon size={17} /></span></div><p className="mt-3 text-xl font-semibold text-white">{card.value}</p></div>; })}</div>
      <section className="rounded-2xl border border-white/[0.06] bg-[#11151d] p-5 sm:p-6"><h2 className="font-semibold text-white">Verbindungsdetails</h2><dl className="mt-4 divide-y divide-white/[0.05]">{[["Bot-Konfiguration", status?.configured ? "Token konfiguriert" : "Token fehlt"], ["Letzter Heartbeat", status?.lastSeenAt ? new Date(status.lastSeenAt).toLocaleString("de-DE") : "Noch kein Heartbeat"], ["Dashboard-Aktualisierung", updatedAt?.toLocaleTimeString("de-DE") || "Wird geladen"]].map(([label, value]) => <div key={label} className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"><dt className="text-slate-500">{label}</dt><dd className="text-slate-200">{value}</dd></div>)}</dl></section>
    </div>
  );
}
