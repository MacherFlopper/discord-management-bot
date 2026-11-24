"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Check, ChevronDown, Clock3, Crown, LoaderCircle, Plus, RefreshCw, Shield,
  Swords, Trash2, Users, X,
} from "lucide-react";
import { formatWholeAmount } from "../../../lib/pricing";

type Guild = { id: string; name: string };
type ClanRole = {
  guild_id: string;
  role_id: string;
  created_at: string;
  guild_name: string;
  name: string;
  color: number;
  position: number;
  member_count: number;
  place: number;
  base_price: number;
  current_price: number;
  discount_active: boolean;
  discount_percent: number;
  configured_discount_percent: number | null;
  discount_expires_at: string | null;
};
type DiscordRole = { id: string; name: string; clan_eligible: boolean };
type Member = { id: string; username: string; display_name: string | null; avatar: string | null };

const fieldClass = "h-11 w-full rounded-lg border border-white/[0.08] bg-[#0b0e14] px-3 text-sm text-slate-100 outline-none transition focus:border-violet-500/60";

function toLocalDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export default function ClansPage() {
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [guildId, setGuildId] = useState("");
  const [clans, setClans] = useState<ClanRole[]>([]);
  const [roles, setRoles] = useState<DiscordRole[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedRole, setSelectedRole] = useState<ClanRole | null>(null);
  const [discountRole, setDiscountRole] = useState<ClanRole | null>(null);
  const [roleToAdd, setRoleToAdd] = useState("");
  const [discountPercent, setDiscountPercent] = useState("50");
  const [discountExpiresAt, setDiscountExpiresAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingDiscount, setSavingDiscount] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    fetch("/api/guilds")
      .then(async (response) => {
        if (!response.ok) throw new Error("Serverliste konnte nicht geladen werden.");
        return response.json() as Promise<Guild[]>;
      })
      .then((data) => {
        setGuilds(data);
        if (data.length) setGuildId(data[0].id);
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Serverliste konnte nicht geladen werden."))
      .finally(() => setLoading(false));
  }, []);

  async function loadClanRoles(serverId = guildId) {
    if (!serverId) return;
    setLoading(true);
    setError("");
    try {
      const [clanResponse, roleResponse] = await Promise.all([
        fetch(`/api/clans?guildId=${encodeURIComponent(serverId)}`),
        fetch(`/api/roles?guildId=${encodeURIComponent(serverId)}`),
      ]);
      if (!clanResponse.ok || !roleResponse.ok) throw new Error("Clan-Rollen konnten nicht geladen werden.");
      const [clanData, roleData] = await Promise.all([clanResponse.json(), roleResponse.json()]);
      setClans(clanData as ClanRole[]);
      setRoles(roleData as DiscordRole[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Clan-Rollen konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!guildId) return;
    let active = true;
    Promise.all([
      fetch(`/api/clans?guildId=${encodeURIComponent(guildId)}`).then((response) => response.json()),
      fetch(`/api/roles?guildId=${encodeURIComponent(guildId)}`).then((response) => response.json()),
    ]).then(([clanData, roleData]) => {
      if (!active) return;
      setClans(clanData as ClanRole[]);
      setRoles(roleData as DiscordRole[]);
    }).catch(() => {
      if (active) setError("Clan-Rollen konnten nicht geladen werden.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [guildId]);

  useEffect(() => {
    if (!guildId) return;
    const interval = setInterval(() => {
      fetch(`/api/clans?guildId=${encodeURIComponent(guildId)}`)
        .then(async (response) => {
          if (!response.ok) throw new Error("Clan-Mitgliederzahlen konnten nicht aktualisiert werden.");
          return response.json() as Promise<ClanRole[]>;
        })
        .then(setClans)
        .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Clan-Mitgliederzahlen konnten nicht aktualisiert werden."));
    }, 30_000);
    return () => clearInterval(interval);
  }, [guildId]);

  const availableRoles = useMemo(() => {
    const registered = new Set(clans.map((clan) => clan.role_id));
    return roles.filter((role) => role.clan_eligible && !registered.has(role.id));
  }, [clans, roles]);
  const memberTotal = clans.reduce((sum, role) => sum + role.member_count, 0);

  async function registerRole() {
    if (!guildId || !roleToAdd) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/clans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guildId, roleId: roleToAdd }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Clan-Rolle konnte nicht hinzugefügt werden.");
      const role = roles.find((item) => item.id === roleToAdd);
      setNotice(`Discord-Rolle ${role?.name || ""} wird jetzt als Clan angezeigt.`);
      setRoleToAdd("");
      await loadClanRoles();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Clan-Rolle konnte nicht hinzugefügt werden.");
    } finally {
      setSaving(false);
    }
  }

  async function showMembers(role: ClanRole) {
    setSelectedRole(role);
    setError("");
    try {
      const response = await fetch(`/api/clans/${role.role_id}/members?guildId=${encodeURIComponent(role.guild_id)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Mitglieder konnten nicht geladen werden.");
      setMembers(data as Member[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Mitglieder konnten nicht geladen werden.");
    }
  }

  async function removeRole(role: ClanRole) {
    if (!window.confirm(`„${role.name}“ nur aus der Clan-Übersicht entfernen? Die Discord-Rolle selbst bleibt erhalten.`)) return;
    try {
      const response = await fetch(`/api/clans/${role.role_id}?guildId=${encodeURIComponent(role.guild_id)}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Clan-Rolle konnte nicht entfernt werden.");
      setNotice(`„${role.name}“ wurde aus der Clan-Übersicht entfernt. Die Discord-Rolle ist unverändert.`);
      if (selectedRole?.role_id === role.role_id) {
        setSelectedRole(null);
        setMembers([]);
      }
      await loadClanRoles();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Clan-Rolle konnte nicht entfernt werden.");
    }
  }

  async function updateDiscount(role: ClanRole, percent: number, expiresAt: string | null) {
    setSavingDiscount(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/clans/${role.role_id}?guildId=${encodeURIComponent(role.guild_id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discountPercent: percent, expiresAt }),
      });
      const data = await response.json() as { error?: unknown; saved?: boolean; announcementSent?: boolean };
      if (!response.ok) {
        if (data.saved) await loadClanRoles(role.guild_id);
        throw new Error(typeof data.error === "string" ? data.error : "Rabatt konnte nicht gespeichert werden.");
      }
      const action = percent ? `Rabatt für ${role.name} gespeichert` : `Rabatt für ${role.name} entfernt`;
      setNotice(data.announcementSent ? `${action} und in Discord angekündigt.` : `${action}. Der Preis bleibt unverändert.`);
      setDiscountRole(null);
      await loadClanRoles(role.guild_id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Rabatt konnte nicht gespeichert werden.");
    } finally {
      setSavingDiscount(false);
    }
  }

  async function saveDiscount() {
    if (!discountRole) return;
    const percent = Number(discountPercent);
    const expiry = new Date(discountExpiresAt);
    if (!Number.isInteger(percent) || percent < 1 || percent > 99 || !discountExpiresAt || Number.isNaN(expiry.getTime())) {
      setError("Gib einen Rabatt von 1–99 % und ein gültiges Ablaufdatum an.");
      return;
    }
    await updateDiscount(discountRole, percent, expiry.toISOString());
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-violet-400/15 bg-gradient-to-br from-[#251a45] via-[#151326] to-[#10131b] p-5 sm:p-7">
        <div className="pointer-events-none absolute -right-10 -top-20 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-300/15 bg-violet-300/[0.07] px-3 py-1 text-xs text-violet-200"><Swords size={13} /> COMMUNITY · DISCORD-ROLLEN</div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">Clan-Panel</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">Mitgliederzahlen werden laufend aus den Discord-Rollen aktualisiert. Der nächste Beitrittspreis richtet sich nach dem Mitgliederplatz; Rabattänderungen werden in Discord angekündigt.</p>
          </div>
          <select value={guildId} onChange={(event) => { setGuildId(event.target.value); setSelectedRole(null); setMembers([]); }} disabled={!guilds.length} className={`${fieldClass} min-w-52 md:max-w-64`}>
            {guilds.length ? guilds.map((guild) => <option key={guild.id} value={guild.id}>{guild.name}</option>) : <option>Kein Server verbunden</option>}
          </select>
        </div>
      </section>

      {error && <div role="alert" className="flex items-start justify-between rounded-xl border border-rose-500/20 bg-rose-500/[0.07] px-4 py-3 text-sm text-rose-200"><span>{error}</span><button aria-label="Fehlermeldung schließen" onClick={() => setError("")}><X size={16} /></button></div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.07] px-4 py-3 text-sm text-emerald-200">{notice}</div>}

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Clan-Rollen", value: clans.length, icon: Shield, tone: "text-violet-300 bg-violet-400/10" },
          { label: "Zuordnungen", value: memberTotal, icon: Users, tone: "text-cyan-300 bg-cyan-400/10" },
          { label: "Discord-Rollen verfügbar", value: availableRoles.length, icon: Check, tone: "text-amber-300 bg-amber-400/10" },
        ].map((stat) => {
          const Icon = stat.icon;
          return <div key={stat.label} className="rounded-xl border border-white/[0.06] bg-[#11151d] p-4"><div className="flex items-center justify-between"><p className="text-sm text-slate-400">{stat.label}</p><span className={`grid h-9 w-9 place-items-center rounded-lg ${stat.tone}`}><Icon size={17} /></span></div><p className="mt-3 text-2xl font-semibold text-white">{stat.value}</p></div>;
        })}
      </div>

      <section className="rounded-2xl border border-white/[0.06] bg-[#11151d]">
        <div className="flex flex-col gap-3 border-b border-white/[0.06] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="font-semibold text-white">Clan-Übersicht</h2><p className="mt-1 text-xs text-slate-500">Es werden nur die von dir ausgewählten, sicheren Rollen angezeigt.</p></div>
          <div className="flex gap-2">
            <select className={`${fieldClass} min-w-48`} value={roleToAdd} onChange={(event) => setRoleToAdd(event.target.value)} disabled={!availableRoles.length}>
              <option value="">Discord-Rolle auswählen</option>
              {availableRoles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
            </select>
            <button onClick={() => void registerRole()} disabled={!roleToAdd || saving} className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg bg-violet-500 px-3 text-sm font-medium text-white hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50"><Plus size={16} /><span className="hidden sm:inline">Clan hinzufügen</span></button>
            <button onClick={() => void loadClanRoles()} title="Aktualisieren" className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-white/[0.08] text-slate-400 hover:bg-white/[0.04]"><RefreshCw size={16} /></button>
          </div>
        </div>

        {!guilds.length ? (
          <div className="px-6 py-14 text-center"><Swords size={28} className="mx-auto mb-3 text-amber-300" /><h3 className="font-medium text-white">Noch kein Discord-Server verbunden</h3><p className="mt-2 text-sm text-slate-500">Lade den Bot auf deinen Server und synchronisiere die Rollen.</p></div>
        ) : loading ? (
          <div className="flex items-center justify-center gap-2 px-6 py-14 text-sm text-slate-500"><LoaderCircle size={17} className="animate-spin" /> Rollen werden geladen</div>
        ) : clans.length === 0 ? (
          <div className="px-6 py-14 text-center"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-violet-500/10 text-violet-300"><Swords size={24} /></div><h3 className="mt-4 font-medium text-white">Noch keine Clan-Rollen ausgewählt</h3><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">Wähle oben eine vorhandene Discord-Rolle aus. Rollen mit Admin- oder Moderationsrechten sind absichtlich ausgeschlossen. Die Discord-Rolle selbst wird nicht geändert.</p></div>
        ) : (
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {clans.map((role) => {
              const roleColor = role.color ? `#${role.color.toString(16).padStart(6, "0")}` : "#a78bfa";
              return (
                <article key={`${role.guild_id}:${role.role_id}`} className={`rounded-xl border bg-[#0d1017] p-4 transition hover:bg-[#11151d] ${selectedRole?.role_id === role.role_id ? "border-violet-400/30" : "border-white/[0.06]"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3"><span className="h-10 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: roleColor }} /><div className="min-w-0"><h3 className="truncate font-medium text-white">{role.name}</h3><p className="mt-1 truncate font-mono text-[10px] text-slate-600">{role.role_id}</p></div></div>
                    <button onClick={() => void removeRole(role)} aria-label={`${role.name} aus Clan-Übersicht entfernen`} title="Aus Übersicht entfernen" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-600 hover:bg-rose-500/10 hover:text-rose-300"><Trash2 size={14} /></button>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3">
                    <span className="inline-flex items-center gap-1.5 text-sm text-slate-400"><Users size={15} />{role.member_count} Mitglieder</span>
                    <span className="text-xs text-slate-500">Platz {role.place}</span>
                    <button onClick={() => void showMembers(role)} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-violet-300 hover:bg-violet-400/10">Mitglieder <ChevronDown size={14} /></button>
                  </div>
                  <div className="mt-3 rounded-lg border border-white/[0.05] bg-white/[0.02] p-3">
                    <p className="text-xs text-slate-500">Beitrittspreis an axxinde</p>
                    <p className="mt-1 text-lg font-semibold text-white">
                      {role.discount_active && <s className="mr-2 text-sm font-normal text-slate-600">{formatWholeAmount(role.base_price)}</s>}
                      {formatWholeAmount(role.current_price)}
                    </p>
                    {role.discount_active && role.discount_expires_at && <p className="mt-1 inline-flex items-center gap-1 text-xs text-amber-300"><Clock3 size={12} />−{role.discount_percent}% bis {new Date(role.discount_expires_at).toLocaleString("de-DE", { timeZone: "Europe/Berlin" })}</p>}
                    {!role.discount_active && role.configured_discount_percent !== null && <p className="mt-1 text-xs text-slate-500">Rabatt abgelaufen</p>}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button onClick={() => {
                        setDiscountRole(role);
                        setDiscountPercent(String(role.discount_active ? role.discount_percent : role.configured_discount_percent || 50));
                        setDiscountExpiresAt(toLocalDateTime(role.discount_expires_at));
                      }} className="rounded-lg border border-violet-400/20 px-2.5 py-1.5 text-xs text-violet-200 hover:bg-violet-400/10">{role.discount_active ? "Rabatt ändern" : "Rabatt einstellen"}</button>
                      {role.configured_discount_percent !== null && <button onClick={() => void updateDiscount(role, 0, null)} disabled={savingDiscount} className="rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-xs text-slate-400 hover:bg-white/[0.04] disabled:opacity-50">Rabatt entfernen</button>}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {discountRole && (
        <section className="rounded-2xl border border-violet-400/15 bg-[#11151d] p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-xs font-semibold tracking-widest text-violet-300">RABATT EINSTELLEN</p><h2 className="mt-1 text-lg font-semibold text-white">{discountRole.name}</h2><p className="mt-1 text-sm text-slate-500">Der Rabatt gilt für den aktuell berechneten Beitrittspreis und endet automatisch.</p></div>
            <button onClick={() => setDiscountRole(null)} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-white/[0.05] hover:text-white" aria-label="Rabattbearbeitung schließen"><X size={17} /></button>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
            <label className="space-y-1.5 text-xs text-slate-400">Rabatt in Prozent<input type="number" min="1" max="99" step="1" value={discountPercent} onChange={(event) => setDiscountPercent(event.target.value)} className={fieldClass} /></label>
            <label className="space-y-1.5 text-xs text-slate-400">Ablaufdatum und Uhrzeit (deine lokale Zeit)<input type="datetime-local" value={discountExpiresAt} onChange={(event) => setDiscountExpiresAt(event.target.value)} className={fieldClass} /></label>
            <button onClick={() => void saveDiscount()} disabled={savingDiscount} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-violet-500 px-4 text-sm font-medium text-white hover:bg-violet-400 disabled:opacity-50">{savingDiscount ? <LoaderCircle size={15} className="animate-spin" /> : <Check size={15} />} Rabatt speichern</button>
          </div>
          <p className="mt-3 text-xs text-slate-500">Discord-Ankündigungen benötigen einen gespeicherten Channel unter <Link href="/prices" className="text-violet-300 hover:underline">Preislisten</Link>.</p>
        </section>
      )}

      {selectedRole && (
        <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#11151d]">
          <div className="flex items-center justify-between border-b border-white/[0.06] p-5"><div><p className="text-xs font-semibold tracking-widest text-violet-300">DISCORD-ROLLE</p><h2 className="mt-1 text-lg font-semibold text-white">{selectedRole.name} <span className="ml-1 text-sm font-normal text-slate-500">· {members.length} Mitglieder</span></h2></div><button onClick={() => setSelectedRole(null)} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-white/[0.05] hover:text-white" aria-label="Mitgliederansicht schließen"><X size={17} /></button></div>
          {members.length ? <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">{members.map((member) => <div key={member.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-white/[0.05] bg-[#0d1017] px-3 py-2.5"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-violet-400/10 text-sm font-semibold text-violet-200">{(member.display_name || member.username).slice(0, 1).toUpperCase()}</div><div className="min-w-0"><p className="truncate text-sm text-slate-200">{member.display_name || member.username}</p><p className="truncate text-xs text-slate-600">@{member.username}</p></div><Crown size={13} className="ml-auto shrink-0 text-slate-700" /></div>)}</div> : <div className="px-5 py-10 text-center text-sm text-slate-500">Keine zugeordneten Mitglieder gefunden.</div>}
        </section>
      )}
      <p className="flex items-center gap-2 text-xs text-slate-600"><Shield size={13} /> Der Bot braucht „Rollen verwalten“ und seine Bot-Rolle muss in der Server-Rollenliste über der Clan-Rolle stehen.</p>
    </div>
  );
}
