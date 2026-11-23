"use client";

import { useEffect, useState } from "react";
import {
  Bot,
  RefreshCw,
  Server,
  UserRound,
} from "lucide-react";

type Guild = { id: string; name: string; member_count: number };
type Status = {
  botOnline: boolean;
  botName: string | null;
  botState: string;
  guildCount: number;
};

export default function ToolsPage() {
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/guilds").then((response) => response.ok ? response.json() : []),
      fetch("/api/status").then((response) => response.ok ? response.json() : null),
    ]).then(([guildData, statusData]) => {
      setGuilds(guildData);
      setStatus(statusData);
    }).finally(() => setLoading(false));
  }, []);

  const tools = [
    {
      icon: RefreshCw,
      title: "Server synchronisieren",
      command: "/sync",
      description: "Lädt Mitglieder, Rollen, Channels und Slash-Commands erneut.",
      permission: "Server verwalten",
    },
    {
      icon: Server,
      title: "Serverinformationen",
      command: "/serverinfo",
      description: "Zeigt Owner, ID, Mitgliederzahl und Erstellungsdatum.",
      permission: "Keine Sonderrechte",
    },
    {
      icon: UserRound,
      title: "Benutzerinformationen",
      command: "/userinfo",
      description: "Zeigt Discord-ID, Bot-Status und Serverbeitritt eines Nutzers.",
      permission: "Keine Sonderrechte",
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section className="rounded-2xl border border-white/[0.06] bg-[#11151d] p-5 sm:p-7">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-violet-500/10 text-violet-300">
            <Bot size={21} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-300">Bot-System</p>
            <h1 className="mt-1 text-2xl font-semibold">Werkzeuge</h1>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-xs text-slate-500">Bot</p>
            <p className="mt-1 font-semibold">{loading ? "Lädt..." : status?.botName || "Unbekannt"}</p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-xs text-slate-500">Status</p>
            <p className="mt-1 flex items-center gap-2 font-semibold">
              <span className={`h-2 w-2 rounded-full ${status?.botOnline ? "bg-emerald-400" : "bg-amber-400"}`} />
              {status?.botOnline ? "Online" : status?.botState || "Offline"}
            </p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-xs text-slate-500">Synchronisierte Server</p>
            <p className="mt-1 font-semibold">{loading ? "—" : guilds.length}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <article key={tool.command} className="rounded-xl border border-white/[0.06] bg-[#11151d] p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10 text-violet-300">
                <Icon size={19} />
              </div>
              <h2 className="mt-4 font-semibold">{tool.title}</h2>
              <code className="mt-2 inline-block rounded-md bg-violet-400/[0.08] px-2 py-1 text-xs text-violet-200">{tool.command}</code>
              <p className="mt-3 text-sm leading-6 text-slate-400">{tool.description}</p>
              <p className="mt-3 text-xs text-slate-600">Recht: {tool.permission}</p>
            </article>
          );
        })}
      </section>

      <section className="overflow-hidden rounded-xl border border-white/[0.06] bg-[#11151d]">
        <div className="border-b border-white/[0.06] px-5 py-4">
          <h2 className="font-semibold">Verfügbare Server</h2>
        </div>
        {loading ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">Lädt...</p>
        ) : guilds.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">Noch keine synchronisierten Server.</p>
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {guilds.map((guild) => (
              <div key={guild.id} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="font-medium">{guild.name}</p>
                  <p className="mt-1 text-xs text-slate-600">{guild.member_count} Mitglieder</p>
                </div>
                <code className="text-xs text-slate-500">{guild.id}</code>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
