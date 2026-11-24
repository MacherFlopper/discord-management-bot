"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, Bot, MessageSquare, Package, ShieldCheck, Swords, Ticket } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Status = {
  configured: boolean;
  botOnline: boolean;
  database: string;
  guildCount: number;
  ticketCount: number;
  logCount: number;
  clanCount: number;
  activity: { day: string; count: number }[];
};

export default function Home() {
  const [status, setStatus] = useState<Status | null>(null);
  const [tickets, setTickets] = useState<Record<string, unknown>[]>([]);
  const [logs, setLogs] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/status").then((r) => r.json()),
      fetch("/api/tickets").then((r) => r.json()),
      fetch("/api/logs").then((r) => r.json()),
    ]).then(([statusData, ticketData, logData]) => {
      setStatus(statusData);
      setTickets(ticketData);
      setLogs(logData);
    }).catch(() => setStatus(null));
  }, []);

  const cards = [
    { label: "Server", value: status?.guildCount ?? "—", icon: ShieldCheck, color: "text-blue-400", detail: "Verbundene Server", href: "/servers" },
    { label: "Clans", value: status?.clanCount ?? "—", icon: Swords, color: "text-fuchsia-400", detail: "Community-Clans", href: "/clans" },
    { label: "Preislisten", value: "Öffnen", icon: Package, color: "text-emerald-400", detail: "Clan- & Spawnerpreise", href: "/prices" },
    { label: "Tickets", value: status?.ticketCount ?? "—", icon: Ticket, color: "text-amber-400", detail: "Gesamte Tickets", href: "/tickets" },
    { label: "Aktivitäten", value: status?.logCount ?? "—", icon: MessageSquare, color: "text-cyan-400", detail: "Erfasste Bot-Ereignisse", href: "/logs" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-sm text-slate-500">Übersicht</p>
          <h1 className="text-2xl font-semibold text-white">Willkommen zurück</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${status?.botOnline ? "bg-emerald-400" : "bg-amber-400"}`} />
          <span className="text-sm text-slate-400">{status?.botOnline ? "Bot online" : status?.configured ? "Bot offline" : "Discord-Token fehlt"}</span>
        </div>
      </div>

      {!status?.configured && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.07] px-4 py-3 text-sm text-amber-200">
          Integration ist noch nicht verbunden. Lege <code className="rounded bg-black/20 px-1">DISCORD_TOKEN</code> und <code className="rounded bg-black/20 px-1">DISCORD_CLIENT_ID</code> in <code className="rounded bg-black/20 px-1">.env.local</code> fest.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link href={card.href} key={card.label} className="rounded-xl border border-white/[0.06] bg-[#11151d] p-4 transition hover:-translate-y-0.5 hover:border-white/[0.12] hover:bg-[#141923]">
              <div className="flex items-start justify-between">
                <div><p className="text-sm text-slate-400">{card.label}</p><p className="mt-2 text-3xl font-semibold">{card.value}</p></div>
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-white/[0.04]"><Icon size={18} className={card.color} /></div>
              </div>
              <p className="mt-3 text-xs text-slate-600">{card.detail}</p>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <section className="rounded-xl border border-white/[0.06] bg-[#11151d] p-4 sm:p-5">
          <div className="mb-5 flex items-center justify-between"><div><h2 className="font-semibold">Erfasste Aktivitäten</h2><p className="mt-1 text-xs text-slate-500">Bot-Ereignisse der letzten 7 Tage</p></div><span className="rounded-md border border-white/[0.07] px-2 py-1 text-xs text-slate-400">7 Tage</span></div>
          <div className="h-64">
            {status?.activity && status.activity.some((day) => day.count > 0) ? <ResponsiveContainer width="100%" height="100%">
              <LineChart data={status.activity.map((day) => ({ ...day, label: new Date(`${day.day}T12:00:00`).toLocaleDateString("de-DE", { weekday: "short" }) }))}>
                <XAxis dataKey="label" stroke="#586174" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#586174" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "#171c26", border: "1px solid rgba(255,255,255,.08)", borderRadius: 8 }} />
                <Line type="monotone" dataKey="count" name="Ereignisse" stroke="#8b5cf6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer> : <div className="grid h-full place-items-center text-center"><div><Activity size={26} className="mx-auto mb-2 text-slate-700" /><p className="text-sm text-slate-500">Noch keine Aktivitäten in diesem Zeitraum</p></div></div>}
          </div>
        </section>

        <section className="rounded-xl border border-white/[0.06] bg-[#11151d] p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2"><Activity size={17} className="text-violet-400" /><h2 className="font-semibold">Letzte Aktivitäten</h2></div>
          {logs.length === 0 ? (
            <div className="grid h-56 place-items-center text-center"><div><Bot size={28} className="mx-auto mb-3 text-slate-700" /><p className="text-sm text-slate-500">Noch keine Ereignisse erfasst</p></div></div>
          ) : (
            <div className="space-y-3">{logs.slice(0, 8).map((log) => <div key={String(log.id)} className="border-b border-white/[0.05] pb-3 text-sm"><p className="text-slate-300">{String(log.event_type)}</p><p className="mt-1 text-xs text-slate-600">{String(log.created_at)}</p></div>)}</div>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-white/[0.06] bg-[#11151d]">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-4 sm:px-5"><h2 className="font-semibold">Neueste Tickets</h2><Link href="/tickets" className="text-xs text-violet-400 hover:text-violet-300">Alle anzeigen</Link></div>
        {tickets.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">Keine Tickets vorhanden</div>
        ) : (
          <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-slate-500"><tr><th className="px-5 py-3">ID</th><th className="px-5 py-3">Betreff</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Priorität</th></tr></thead><tbody>{tickets.slice(0, 8).map((ticket) => <tr key={String(ticket.id)} className="border-t border-white/[0.05]"><td className="px-5 py-3 font-mono text-xs text-slate-500">{String(ticket.id)}</td><td className="px-5 py-3">{String(ticket.subject)}</td><td className="px-5 py-3">{String(ticket.status)}</td><td className="px-5 py-3">{String(ticket.priority)}</td></tr>)}</tbody></table></div>
        )}
      </section>
    </div>
  );
}
