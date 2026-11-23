"use client";

import { useEffect, useState } from "react";
import { Check, LoaderCircle, Save, Settings2 } from "lucide-react";

type Guild = { id: string; name: string };
type Channel = { id: string; name: string; type: number };
type GuildSettings = { welcome_channel_id: string | null; welcome_message: string | null };
const fieldClass = "h-11 w-full rounded-lg border border-white/[0.08] bg-[#0b0e14] px-3 text-sm text-slate-100 outline-none focus:border-violet-500/60";

export default function SettingsPage() {
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [guildId, setGuildId] = useState("");
  const [channels, setChannels] = useState<Channel[]>([]);
  const [welcomeChannelId, setWelcomeChannelId] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    fetch("/api/guilds").then((response) => response.json()).then((data: Guild[]) => {
      setGuilds(data);
      if (data.length) setGuildId(data[0].id);
    }).catch(() => setError("Serverliste konnte nicht geladen werden.")).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!guildId) return;
    let active = true;
    Promise.all([
      fetch(`/api/channels?guildId=${encodeURIComponent(guildId)}`).then((response) => response.json()),
      fetch(`/api/settings?guildId=${encodeURIComponent(guildId)}`).then((response) => response.json()),
    ]).then(([channelData, settings]) => {
      if (!active) return;
      setChannels(channelData as Channel[]);
      const current = settings as GuildSettings;
      setWelcomeChannelId(current.welcome_channel_id || "");
      setWelcomeMessage(current.welcome_message || "");
    }).catch(() => {
      if (active) setError("Servereinstellungen konnten nicht geladen werden.");
    });
    return () => { active = false; };
  }, [guildId]);

  async function saveSettings() {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guildId, welcomeChannelId, welcomeMessage }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Einstellungen konnten nicht gespeichert werden.");
      setNotice("Einstellungen gespeichert. Neue Mitglieder erhalten die konfigurierte Willkommensnachricht.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Einstellungen konnten nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <section className="rounded-2xl border border-white/[0.06] bg-[#11151d] p-5 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><div className="mb-2 inline-flex items-center gap-2 text-xs font-semibold tracking-widest text-violet-300"><Settings2 size={14} /> SERVER-KONFIGURATION</div><h1 className="text-2xl font-semibold text-white">Einstellungen</h1><p className="mt-2 text-sm text-slate-500">Konfigurationen werden pro Discord-Server gespeichert.</p></div><select className={`${fieldClass} sm:max-w-64`} value={guildId} onChange={(event) => setGuildId(event.target.value)}>{guilds.length ? guilds.map((guild) => <option key={guild.id} value={guild.id}>{guild.name}</option>) : <option value="">Kein Server synchronisiert</option>}</select></div>
      </section>

      {error && <div role="alert" className="rounded-xl border border-rose-500/20 bg-rose-500/[0.07] px-4 py-3 text-sm text-rose-200">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.07] px-4 py-3 text-sm text-emerald-200">{notice}</div>}

      {loading ? <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500"><LoaderCircle size={17} className="animate-spin" /> Wird geladen</div> : !guildId ? <div className="rounded-xl border border-dashed border-white/[0.08] p-10 text-center text-sm text-slate-500">Füge den Bot einem Discord-Server hinzu, um Einstellungen zu verwalten.</div> : (
        <section className="rounded-2xl border border-white/[0.06] bg-[#11151d] p-5 sm:p-6">
          <div className="mb-5"><h2 className="font-semibold text-white">Willkommen & Abschied</h2><p className="mt-1 text-sm text-slate-500">Neue Mitglieder erhalten beim Beitritt eine Nachricht im ausgewählten Channel.</p></div>
          <label className="mb-4 block space-y-1.5 text-xs text-slate-400">Willkommens-Channel<select className={fieldClass} value={welcomeChannelId} onChange={(event) => setWelcomeChannelId(event.target.value)}><option value="">Deaktiviert</option>{channels.filter((channel) => channel.type === 0 || channel.type === 5).map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}</select></label>
          <label className="block space-y-1.5 text-xs text-slate-400">Nachricht<textarea maxLength={1000} rows={4} className="w-full rounded-lg border border-white/[0.08] bg-[#0b0e14] p-3 text-sm text-slate-100 outline-none focus:border-violet-500/60" value={welcomeMessage} onChange={(event) => setWelcomeMessage(event.target.value)} placeholder="Willkommen {user} auf {server}!" /><span className="block text-right text-[10px] text-slate-600">{welcomeMessage.length}/1000 · Platzhalter: {"{user}"}, {"{username}"}, {"{server}"}, {"{memberCount}"}</span></label>
          <div className="mt-5 flex justify-end"><button onClick={() => void saveSettings()} disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-lg bg-violet-500 px-4 text-sm font-medium text-white hover:bg-violet-400 disabled:opacity-50">{saving ? <LoaderCircle size={15} className="animate-spin" /> : <Save size={15} />} Speichern</button></div>
        </section>
      )}
      <div className="flex items-start gap-3 rounded-xl border border-violet-400/10 bg-violet-400/[0.04] p-4 text-xs leading-5 text-slate-500"><Check size={15} className="mt-0.5 shrink-0 text-violet-300" />Die Willkommensnachricht wird vom Bot nur gesendet, wenn er den ausgewählten Channel sehen und Nachrichten senden darf.</div>
    </div>
  );
}
