"use client";

import { useEffect, useState } from "react";
import { History, LoaderCircle, Package, Save, Send } from "lucide-react";
import { formatMillions } from "../../../lib/pricing";

type Guild = { id: string; name: string };
type Channel = { id: string; name: string; type: number };
type SpawnerPrice = {
  guild_id: string;
  spawner_key: string;
  name: string;
  emoji: string;
  buy_price: number;
  sell_price: number;
  updated_at: string;
};
type PriceChange = {
  spawner_key: string;
  old_buy_price: number;
  new_buy_price: number;
  old_sell_price: number;
  new_sell_price: number;
  created_at: string;
};
type PriceData = {
  prices: SpawnerPrice[];
  history: PriceChange[];
  announcementChannelId: string | null;
};
type Draft = { buy: string; sell: string };

function toMillionsInput(amount: number) {
  return String(amount / 1_000_000);
}

function parseMillions(value: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000 || !Number.isInteger(amount * 10)) return null;
  return Math.round(amount * 1_000_000);
}

async function loadPriceData(guildId: string) {
  const [priceResponse, channelResponse] = await Promise.all([
    fetch(`/api/spawner-prices?guildId=${encodeURIComponent(guildId)}`),
    fetch(`/api/channels?guildId=${encodeURIComponent(guildId)}`),
  ]);
  const priceData = await priceResponse.json() as PriceData & { error?: string };
  const channelData = await channelResponse.json() as Channel[] | { error?: string };
  if (!priceResponse.ok) throw new Error(priceData.error || "Spawnerpreise konnten nicht geladen werden.");
  if (!channelResponse.ok || !Array.isArray(channelData)) {
    throw new Error("Discord-Channels konnten nicht geladen werden.");
  }
  return {
    priceData,
    channels: channelData.filter((channel) => channel.type === 0 || channel.type === 5),
  };
}

export default function PricesPage() {
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [guildId, setGuildId] = useState("");
  const [prices, setPrices] = useState<SpawnerPrice[]>([]);
  const [history, setHistory] = useState<PriceChange[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [announcementChannelId, setAnnouncementChannelId] = useState("");
  const [channelDraftId, setChannelDraftId] = useState("");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState("");
  const [savingChannel, setSavingChannel] = useState(false);
  const [publishingList, setPublishingList] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    fetch("/api/guilds")
      .then(async (response) => {
        const data = await response.json() as Guild[] | { error?: string };
        if (!response.ok || !Array.isArray(data)) throw new Error("Serverliste konnte nicht geladen werden.");
        setGuilds(data);
        if (data.length) setGuildId(data[0].id);
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Serverliste konnte nicht geladen werden."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!guildId) return;
    let active = true;
    Promise.resolve()
      .then(() => {
        if (!active) return null;
        setLoading(true);
        setError("");
        return loadPriceData(guildId);
      })
      .then((loaded) => {
        if (!active || !loaded) return;
        const { priceData, channels: availableChannels } = loaded;
        setPrices(priceData.prices);
        setHistory(priceData.history);
        setChannels(availableChannels);
        setAnnouncementChannelId(priceData.announcementChannelId || "");
        setChannelDraftId(priceData.announcementChannelId || "");
        setDrafts(Object.fromEntries(priceData.prices.map((price) => [
          price.spawner_key,
          { buy: toMillionsInput(price.buy_price), sell: toMillionsInput(price.sell_price) },
        ])));
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Preise konnten nicht geladen werden.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [guildId]);

  async function refreshPrices() {
    if (!guildId) return;
    const { priceData } = await loadPriceData(guildId);
    setPrices(priceData.prices);
    setHistory(priceData.history);
    setAnnouncementChannelId(priceData.announcementChannelId || "");
    setChannelDraftId(priceData.announcementChannelId || "");
    setDrafts(Object.fromEntries(priceData.prices.map((price) => [
      price.spawner_key,
      { buy: toMillionsInput(price.buy_price), sell: toMillionsInput(price.sell_price) },
    ])));
  }

  async function saveAnnouncementChannel() {
    if (!guildId) return;
    setSavingChannel(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/spawner-prices/channel", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guildId, channelId: channelDraftId }),
      });
      const result = await response.json() as { error?: unknown };
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Channel konnte nicht gespeichert werden.");
      setAnnouncementChannelId(channelDraftId);
      setNotice("Ankündigungskanal gespeichert.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Channel konnte nicht gespeichert werden.");
    } finally {
      setSavingChannel(false);
    }
  }

  async function publishPriceList() {
    if (!guildId || !announcementChannelId || channelDraftId !== announcementChannelId) return;
    setPublishingList(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/spawner-prices/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guildId }),
      });
      const result = await response.json() as { error?: unknown };
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Preisliste konnte nicht gesendet werden.");
      setNotice("Die aktuelle Spawner-Preisliste wurde in Discord veröffentlicht.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Preisliste konnte nicht gesendet werden.");
    } finally {
      setPublishingList(false);
    }
  }

  async function savePrice(price: SpawnerPrice) {
    if (!guildId) return;
    const draft = drafts[price.spawner_key];
    const buyPrice = parseMillions(draft?.buy || "");
    const sellPrice = parseMillions(draft?.sell || "");
    if (buyPrice === null || sellPrice === null) {
      setError("Preise müssen gültige, nicht negative Millionenbeträge sein.");
      return;
    }

    setSavingKey(price.spawner_key);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/spawner-prices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guildId, spawnerKey: price.spawner_key, buyPrice, sellPrice }),
      });
      const result = await response.json() as { error?: unknown; saved?: boolean; unchanged?: boolean };
      if (!response.ok) {
        if (result.saved) await refreshPrices();
        throw new Error(typeof result.error === "string" ? result.error : "Preis konnte nicht gespeichert werden.");
      }
      setNotice(result.unchanged ? "Keine Preisänderung erkannt." : "Preis gespeichert und in Discord angekündigt.");
      await refreshPrices();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Preis konnte nicht gespeichert werden.");
    } finally {
      setSavingKey("");
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="rounded-2xl border border-white/[0.06] bg-[#11151d] p-5 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 text-xs font-semibold tracking-widest text-violet-300"><Package size={14} /> PREISVERWALTUNG</div>
            <h1 className="text-2xl font-semibold text-white">Spawner-Preise</h1>
            <p className="mt-2 text-sm text-slate-500">Kauf- und Verkaufspreise verwalten. Änderungen werden mit Alt- und Neupreis in Discord angekündigt.</p>
          </div>
          <select className="h-11 w-full rounded-lg border border-white/[0.08] bg-[#0b0e14] px-3 text-sm text-slate-100 outline-none focus:border-violet-500/60 sm:max-w-64" value={guildId} onChange={(event) => { setError(""); setLoading(true); setGuildId(event.target.value); }} disabled={!guilds.length || savingChannel || Boolean(savingKey)}>
            {guilds.length ? guilds.map((guild) => <option key={guild.id} value={guild.id}>{guild.name}</option>) : <option value="">Kein Server synchronisiert</option>}
          </select>
        </div>
      </section>

      {error && <div role="alert" className="rounded-xl border border-rose-500/20 bg-rose-500/[0.07] px-4 py-3 text-sm text-rose-200">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.07] px-4 py-3 text-sm text-emerald-200">{notice}</div>}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500"><LoaderCircle size={17} className="animate-spin" /> Preise werden geladen</div>
      ) : !guildId ? (
        <div className="rounded-xl border border-dashed border-white/[0.08] p-10 text-center text-sm text-slate-500">Füge den Bot einem Discord-Server hinzu, um Preise zu verwalten.</div>
      ) : (
        <>
          <section className="rounded-2xl border border-white/[0.06] bg-[#11151d] p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-2"><Send size={17} className="text-violet-300" /><h2 className="font-semibold text-white">Discord-Ankündigungen</h2></div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <select className="h-11 min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-[#0b0e14] px-3 text-sm text-slate-100 outline-none focus:border-violet-500/60" value={channelDraftId} onChange={(event) => setChannelDraftId(event.target.value)} disabled={savingChannel || publishingList}>
                <option value="">Channel auswählen</option>
                {channels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
              </select>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button onClick={() => void saveAnnouncementChannel()} disabled={savingChannel || publishingList || !channelDraftId || channelDraftId === announcementChannelId} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-violet-500 px-4 text-sm font-medium text-white hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50">
                  {savingChannel ? <LoaderCircle size={15} className="animate-spin" /> : <Save size={15} />} Channel speichern
                </button>
                <button onClick={() => void publishPriceList()} disabled={publishingList || savingChannel || !announcementChannelId || channelDraftId !== announcementChannelId} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-violet-400/30 px-4 text-sm font-medium text-violet-200 hover:bg-violet-400/10 disabled:cursor-not-allowed disabled:opacity-50">
                  {publishingList ? <LoaderCircle size={15} className="animate-spin" /> : <Send size={15} />} Preisliste senden
                </button>
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-500">Du kannst die komplette Liste hier senden. Bei Preisänderungen werden zusätzlich der Preisvergleich und die neue Gesamtliste veröffentlicht.</p>
          </section>

          <section className="rounded-2xl border border-white/[0.06] bg-[#11151d]">
            <div className="border-b border-white/[0.06] p-5"><h2 className="font-semibold text-white">Spawner An- und Verkauf</h2><p className="mt-1 text-xs text-slate-500">Beträge werden in Millionen angegeben, zum Beispiel 25.5.</p></div>
            <div className="divide-y divide-white/[0.05]">
              {prices.map((price) => {
                const draft = drafts[price.spawner_key] || { buy: "", sell: "" };
                return (
                  <div key={price.spawner_key} className="grid gap-4 p-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
                    <div className="flex items-center gap-3">
                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-500/10 text-violet-300"><Package size={18} /></span>
                      <div><p className="font-medium text-white">{price.name}</p><p className="text-xs text-slate-500">Aktuell: Kauf {formatMillions(price.buy_price)} · Verkauf {formatMillions(price.sell_price)}</p></div>
                    </div>
                    <label className="space-y-1.5 text-xs text-slate-400">Wir kaufen (Mio.)<input type="number" min="0" max="1000000" step="0.1" value={draft.buy} onChange={(event) => setDrafts((current) => ({ ...current, [price.spawner_key]: { ...draft, buy: event.target.value } }))} className="h-10 w-full rounded-lg border border-white/[0.08] bg-[#0b0e14] px-3 text-sm text-slate-100 outline-none focus:border-violet-500/60" /></label>
                    <label className="space-y-1.5 text-xs text-slate-400">Wir verkaufen (Mio.)<input type="number" min="0" max="1000000" step="0.1" value={draft.sell} onChange={(event) => setDrafts((current) => ({ ...current, [price.spawner_key]: { ...draft, sell: event.target.value } }))} className="h-10 w-full rounded-lg border border-white/[0.08] bg-[#0b0e14] px-3 text-sm text-slate-100 outline-none focus:border-violet-500/60" /></label>
                    <button onClick={() => void savePrice(price)} disabled={Boolean(savingKey) || !announcementChannelId || channelDraftId !== announcementChannelId} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-violet-400/20 px-3 text-sm text-violet-200 hover:bg-violet-400/10 disabled:cursor-not-allowed disabled:opacity-40">
                      {savingKey === price.spawner_key ? <LoaderCircle size={15} className="animate-spin" /> : <Save size={15} />} Speichern
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-white/[0.06] bg-[#11151d]">
            <div className="flex items-center gap-2 border-b border-white/[0.06] p-5"><History size={17} className="text-slate-400" /><h2 className="font-semibold text-white">Letzte Preisänderungen</h2></div>
            {!history.length ? <p className="px-5 py-8 text-center text-sm text-slate-500">Noch keine Preisänderungen.</p> : (
              <div className="divide-y divide-white/[0.05]">
                {history.map((change, index) => {
                  const price = prices.find((item) => item.spawner_key === change.spawner_key);
                  const showChange = (oldPrice: number, newPrice: number) => oldPrice === newPrice
                    ? formatMillions(newPrice)
                    : <><s className="text-slate-500">{formatMillions(oldPrice)}</s> → <strong>{formatMillions(newPrice)}</strong></>;
                  return (
                    <div key={`${change.spawner_key}-${change.created_at}-${index}`} className="flex flex-col gap-1 px-5 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-slate-300">{price?.name || change.spawner_key}: Kauf {showChange(change.old_buy_price, change.new_buy_price)} · Verkauf {showChange(change.old_sell_price, change.new_sell_price)}</p>
                      <time className="text-xs text-slate-600">{new Date(change.created_at).toLocaleString("de-DE", { timeZone: "Europe/Berlin" })}</time>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
