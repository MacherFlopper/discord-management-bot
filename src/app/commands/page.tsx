"use client";

import { useEffect, useState } from "react";
import { Braces, Command, LoaderCircle } from "lucide-react";

type Guild = { id: string; name: string };
type BotCommand = { command_id: string; name: string; description: string; updated_at: string };

export default function CommandsPage() {
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [guildId, setGuildId] = useState("");
  const [commands, setCommands] = useState<BotCommand[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/guilds").then((response) => response.json()).then((data: Guild[]) => {
      setGuilds(data);
      if (data.length) setGuildId(data[0].id);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!guildId) return;
    let active = true;
    fetch(`/api/commands?guildId=${encodeURIComponent(guildId)}`)
      .then((response) => response.json())
      .then((data: BotCommand[]) => { if (active) setCommands(data); });
    return () => { active = false; };
  }, [guildId]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section className="flex flex-col gap-4 rounded-2xl border border-white/[0.06] bg-[#11151d] p-5 sm:flex-row sm:items-end sm:justify-between sm:p-7"><div><div className="mb-2 inline-flex items-center gap-2 text-xs font-semibold tracking-widest text-violet-300"><Braces size={14} /> BOT AUTOMATION</div><h1 className="text-2xl font-semibold text-white">Slash-Commands</h1><p className="mt-2 text-sm text-slate-500">Vom Bot tatsächlich bei Discord registrierte Server-Befehle.</p></div><select className="h-11 rounded-lg border border-white/[0.08] bg-[#0b0e14] px-3 text-sm text-slate-100" value={guildId} onChange={(event) => setGuildId(event.target.value)}>{guilds.length ? guilds.map((guild) => <option key={guild.id} value={guild.id}>{guild.name}</option>) : <option value="">Kein Server</option>}</select></section>
      <section className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#11151d]"><div className="flex items-center justify-between border-b border-white/[0.06] p-5"><div><h2 className="font-semibold text-white">Registrierte Befehle</h2><p className="mt-1 text-xs text-slate-500">{commands.length} von Discord synchronisierte Commands</p></div><Command size={18} className="text-slate-600" /></div>{loading ? <div className="flex items-center justify-center gap-2 py-14 text-sm text-slate-500"><LoaderCircle size={16} className="animate-spin" /> Lädt</div> : commands.length ? <div className="divide-y divide-white/[0.05]">{commands.map((command) => <div key={command.command_id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><code className="rounded-md bg-violet-400/[0.08] px-2 py-1 text-sm text-violet-200">/{command.name}</code><p className="mt-2 text-sm text-slate-400">{command.description}</p></div><p className="text-[11px] text-slate-600">Sync: {new Date(command.updated_at).toLocaleString("de-DE")}</p></div>)}</div> : <div className="px-6 py-14 text-center"><Command size={28} className="mx-auto mb-3 text-slate-700" /><p className="text-sm text-slate-400">Noch keine Commands synchronisiert.</p><p className="mt-1 text-xs text-slate-600">Prüfe, ob der Bot online ist und Discord-Commands registrieren darf.</p></div>}</section>
    </div>
  );
}
