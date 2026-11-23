"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  CirclePlus, Copy, LoaderCircle, MessageSquareMore, PanelsTopLeft,
  Send, Ticket, Trash2,
} from "lucide-react";

type Guild = { id: string; name: string };
type Channel = { id: string; name: string; type: number };
type Role = { id: string; name: string; managed: number };
type Panel = {
  id: string;
  name: string;
  title: string;
  description: string;
  panel_channel_id: string;
  panel_channel_name: string | null;
  ticket_category_id: string | null;
  ticket_category_name: string | null;
  support_role_id: string | null;
  support_role_name: string | null;
  button_label: string;
};
type TicketRow = {
  id: string;
  creator_id: string;
  creator_name: string | null;
  subject: string;
  category: string | null;
  status: string;
  priority: string;
  channel_id: string | null;
  created_at: string;
  updated_at: string;
};

const fieldClass = "h-11 w-full rounded-lg border border-white/[0.08] bg-[#0b0e14] px-3 text-sm text-slate-100 outline-none transition focus:border-violet-500/60";

export default function TicketsPage() {
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [guildId, setGuildId] = useState("");
  const [channels, setChannels] = useState<Channel[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [panels, setPanels] = useState<Panel[]>([]);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ name: "", title: "", description: "", panelChannelId: "", ticketCategoryId: "", supportRoleId: "", buttonLabel: "Ticket erstellen" });
  const textChannels = useMemo(() => channels.filter((channel) => channel.type === 0 || channel.type === 5), [channels]);
  const categories = useMemo(() => channels.filter((channel) => channel.type === 4), [channels]);

  useEffect(() => {
    fetch("/api/guilds").then((response) => response.json()).then((data: Guild[]) => {
      setGuilds(data);
      if (data.length) setGuildId(data[0].id);
    }).catch(() => setError("Serverliste konnte nicht geladen werden."));
  }, []);

  useEffect(() => {
    if (!guildId) return;
    let active = true;
    Promise.all([
      fetch(`/api/channels?guildId=${encodeURIComponent(guildId)}`).then((response) => response.json()),
      fetch(`/api/roles?guildId=${encodeURIComponent(guildId)}`).then((response) => response.json()),
      fetch(`/api/ticket-panels?guildId=${encodeURIComponent(guildId)}`).then((response) => response.json()),
      fetch(`/api/tickets?guildId=${encodeURIComponent(guildId)}`).then((response) => response.json()),
    ]).then(([channelData, roleData, panelData, ticketData]) => {
      if (!active) return;
      setChannels(channelData as Channel[]);
      setRoles(roleData as Role[]);
      setPanels(panelData as Panel[]);
      setTickets(ticketData as TicketRow[]);
      setForm((current) => ({ ...current, panelChannelId: current.panelChannelId || (channelData as Channel[]).find((channel) => channel.type === 0 || channel.type === 5)?.id || "" }));
    }).catch(() => {
      if (active) setError("Ticketdaten oder Discord-Channels konnten nicht geladen werden.");
    });
    return () => { active = false; };
  }, [guildId]);

  async function refresh() {
    if (!guildId) return;
    const [panelsResponse, ticketsResponse] = await Promise.all([
      fetch(`/api/ticket-panels?guildId=${encodeURIComponent(guildId)}`),
      fetch(`/api/tickets?guildId=${encodeURIComponent(guildId)}`),
    ]);
    if (!panelsResponse.ok || !ticketsResponse.ok) throw new Error("Ticketdaten konnten nicht aktualisiert werden.");
    setPanels(await panelsResponse.json() as Panel[]);
    setTickets(await ticketsResponse.json() as TicketRow[]);
  }

  async function createPanel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/ticket-panels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guildId, ...form }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Ticket-Panel konnte nicht erstellt werden.");
      setNotice(`Panel wurde angelegt. ID: ${data.id}`);
      setForm({ name: "", title: "", description: "", panelChannelId: textChannels[0]?.id || "", ticketCategoryId: "", supportRoleId: "", buttonLabel: "Ticket erstellen" });
      setCreating(false);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ticket-Panel konnte nicht erstellt werden.");
    } finally {
      setSaving(false);
    }
  }

  async function deletePanel(panel: Panel) {
    if (!window.confirm(`Ticket-Panel „${panel.name}“ löschen? Bereits erstellte Tickets bleiben erhalten.`)) return;
    try {
      const response = await fetch(`/api/ticket-panels/${panel.id}?guildId=${encodeURIComponent(guildId)}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Panel konnte nicht gelöscht werden.");
      setNotice(`Panel „${panel.name}“ wurde gelöscht.`);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Panel konnte nicht gelöscht werden.");
    }
  }

  async function copyCommand(panelId: string) {
    await navigator.clipboard.writeText(`/ticketpanel panel_id:${panelId}`);
    setNotice("Veröffentlichungsbefehl kopiert.");
  }

  const openCount = tickets.filter((ticket) => ticket.status !== "closed").length;

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-cyan-400/15 bg-gradient-to-br from-[#112a36] via-[#131a25] to-[#10131b] p-5 sm:p-7">
        <div className="pointer-events-none absolute -right-10 -top-20 h-64 w-64 rounded-full bg-cyan-400/[0.08] blur-3xl" />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div><div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/[0.07] px-3 py-1 text-xs text-cyan-200"><PanelsTopLeft size={13} /> SUPPORT CENTER</div><h1 className="text-3xl font-semibold tracking-tight text-white">Tickets & Panels</h1><p className="mt-2 text-sm text-slate-400">Erstelle unterschiedliche Support-Panels mit eigenen Channels, Kategorien und Support-Rollen.</p></div>
          <div className="flex gap-2"><select className={`${fieldClass} min-w-48`} value={guildId} onChange={(event) => setGuildId(event.target.value)}>{guilds.length ? guilds.map((guild) => <option key={guild.id} value={guild.id}>{guild.name}</option>) : <option value="">Kein Server</option>}</select><button onClick={() => setCreating((value) => !value)} disabled={!guildId} className="inline-flex h-11 items-center gap-2 rounded-lg bg-cyan-500 px-4 text-sm font-medium text-slate-950 hover:bg-cyan-400 disabled:opacity-50"><CirclePlus size={16} /> Panel erstellen</button></div>
        </div>
      </section>

      {error && <div role="alert" className="rounded-xl border border-rose-500/20 bg-rose-500/[0.07] px-4 py-3 text-sm text-rose-200">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.07] px-4 py-3 text-sm text-emerald-200">{notice}</div>}

      <div className="grid gap-3 sm:grid-cols-3">
        {[{ label: "Panels", value: panels.length, icon: PanelsTopLeft }, { label: "Offene Tickets", value: openCount, icon: MessageSquareMore }, { label: "Tickets gesamt", value: tickets.length, icon: Ticket }].map((stat) => {
          const Icon = stat.icon;
          return <div key={stat.label} className="rounded-xl border border-white/[0.06] bg-[#11151d] p-4"><div className="flex items-center justify-between"><p className="text-sm text-slate-400">{stat.label}</p><span className="grid h-9 w-9 place-items-center rounded-lg bg-cyan-400/10 text-cyan-300"><Icon size={17} /></span></div><p className="mt-3 text-2xl font-semibold text-white">{stat.value}</p></div>;
        })}
      </div>

      {creating && (
        <form onSubmit={createPanel} className="rounded-2xl border border-white/[0.07] bg-[#11151d] p-5 sm:p-6">
          <h2 className="mb-4 font-semibold text-white">Ticket-Panel konfigurieren</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="space-y-1.5 text-xs text-slate-400">Interner Name<input required minLength={2} maxLength={50} className={fieldClass} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="z. B. Technischer Support" /></label>
            <label className="space-y-1.5 text-xs text-slate-400">Panel-Titel<input required maxLength={100} className={fieldClass} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Wie können wir helfen?" /></label>
            <label className="space-y-1.5 text-xs text-slate-400">Button-Text<input required maxLength={80} className={fieldClass} value={form.buttonLabel} onChange={(event) => setForm({ ...form, buttonLabel: event.target.value })} /></label>
            <label className="space-y-1.5 text-xs text-slate-400">Panel-Channel<select required className={fieldClass} value={form.panelChannelId} onChange={(event) => setForm({ ...form, panelChannelId: event.target.value })}><option value="">Channel auswählen</option>{textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}</select></label>
            <label className="space-y-1.5 text-xs text-slate-400">Ticket-Kategorie<select className={fieldClass} value={form.ticketCategoryId} onChange={(event) => setForm({ ...form, ticketCategoryId: event.target.value })}><option value="">Keine Kategorie</option>{categories.map((channel) => <option key={channel.id} value={channel.id}>{channel.name}</option>)}</select></label>
            <label className="space-y-1.5 text-xs text-slate-400">Support-Rolle<select className={fieldClass} value={form.supportRoleId} onChange={(event) => setForm({ ...form, supportRoleId: event.target.value })}><option value="">Keine Support-Rolle</option>{roles.filter((role) => role.name !== "@everyone" && !role.managed).map((role) => <option key={role.id} value={role.id}>@{role.name}</option>)}</select></label>
            <label className="space-y-1.5 text-xs text-slate-400 sm:col-span-2 lg:col-span-3">Beschreibung<textarea maxLength={1500} rows={3} className={`${fieldClass} h-auto py-3`} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Beschreibe, wann Nutzer dieses Panel verwenden sollen." /></label>
          </div>
          <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setCreating(false)} className="h-10 rounded-lg border border-white/[0.08] px-4 text-sm text-slate-400 hover:bg-white/[0.04]">Abbrechen</button><button disabled={saving || !textChannels.length} className="inline-flex h-10 items-center gap-2 rounded-lg bg-cyan-500 px-4 text-sm font-medium text-slate-950 hover:bg-cyan-400 disabled:opacity-50">{saving && <LoaderCircle size={15} className="animate-spin" />} Panel speichern</button></div>
        </form>
      )}

      <section className="rounded-2xl border border-white/[0.06] bg-[#11151d]">
        <div className="border-b border-white/[0.06] p-5"><h2 className="font-semibold text-white">Deine Panels</h2><p className="mt-1 text-xs text-slate-500">Veröffentliche jedes Panel mit <code>/ticketpanel panel_id:…</code>. Der Bot muss „Channels verwalten“ besitzen.</p></div>
        {panels.length ? <div className="grid gap-3 p-4 lg:grid-cols-2">{panels.map((panel) => <article key={panel.id} className="rounded-xl border border-white/[0.06] bg-[#0d1017] p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-semibold tracking-widest text-cyan-300">{panel.name}</p><h3 className="mt-1 font-medium text-white">{panel.title}</h3><p className="mt-2 line-clamp-2 text-sm text-slate-500">{panel.description || "Keine Beschreibung."}</p></div><button onClick={() => void deletePanel(panel)} aria-label={`${panel.name} löschen`} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-600 hover:bg-rose-500/10 hover:text-rose-300"><Trash2 size={15} /></button></div><div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500"><span className="rounded-md bg-white/[0.04] px-2 py-1">#{panel.panel_channel_name || panel.panel_channel_id}</span>{panel.ticket_category_name && <span className="rounded-md bg-white/[0.04] px-2 py-1">{panel.ticket_category_name}</span>}{panel.support_role_name && <span className="rounded-md bg-white/[0.04] px-2 py-1">@{panel.support_role_name}</span>}</div><div className="mt-4 flex items-center justify-between border-t border-white/[0.05] pt-3"><code className="truncate text-[10px] text-slate-600">{panel.id}</code><button onClick={() => void copyCommand(panel.id)} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-cyan-300 hover:bg-cyan-300/10"><Copy size={13} /> Befehl kopieren</button></div></article>)}</div> : <div className="px-6 py-10 text-center text-sm text-slate-500">Noch keine Ticket-Panels konfiguriert.</div>}
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#11151d]">
        <div className="flex items-center justify-between border-b border-white/[0.06] p-5"><div><h2 className="font-semibold text-white">Tickets</h2><p className="mt-1 text-xs text-slate-500">Aktive und geschlossene Supportfälle</p></div><Send size={17} className="text-slate-600" /></div>
        {tickets.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-white/[0.015] text-[11px] uppercase tracking-wider text-slate-600"><tr><th className="px-5 py-3">Ticket</th><th className="px-5 py-3">Ersteller</th><th className="px-5 py-3">Panel</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Erstellt</th><th className="px-5 py-3">Channel</th></tr></thead><tbody>{tickets.map((ticket) => <tr key={ticket.id} className="border-t border-white/[0.04] hover:bg-white/[0.015]"><td className="px-5 py-3 font-medium text-slate-200">{ticket.subject}</td><td className="px-5 py-3 text-slate-400">{ticket.creator_name || ticket.creator_id}</td><td className="px-5 py-3 text-slate-400">{ticket.category || "—"}</td><td className="px-5 py-3"><span className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${ticket.status === "closed" ? "bg-slate-700/40 text-slate-400" : "bg-emerald-400/10 text-emerald-300"}`}>{ticket.status}</span></td><td className="whitespace-nowrap px-5 py-3 text-xs text-slate-500">{new Date(ticket.created_at).toLocaleString("de-DE")}</td><td className="px-5 py-3">{ticket.channel_id ? <a className="text-cyan-300 hover:underline" href={`https://discord.com/channels/${guildId}/${ticket.channel_id}`} target="_blank" rel="noreferrer">Öffnen</a> : "—"}</td></tr>)}</tbody></table></div> : <div className="px-6 py-10 text-center text-sm text-slate-500">Noch keine Tickets erstellt. Veröffentliche ein Panel und teste den Button in Discord.</div>}
      </section>
    </div>
  );
}
