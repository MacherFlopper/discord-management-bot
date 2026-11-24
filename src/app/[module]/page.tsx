"use client";

import { Suspense } from "react";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Database, Search } from "lucide-react";

const titles: Record<string, { title: string; description: string }> = {
  servers: { title: "Serverübersicht", description: "Synchronisierte Discord-Server und Konfiguration" },
  tickets: { title: "Tickets", description: "Ticketverwaltung und Supportfälle" },
  moderation: { title: "Moderation", description: "Warnungen, Kicks, Bans und Timeouts" },
  analytics: { title: "Analytics", description: "Auswertung synchronisierter Serverdaten" },
  "bot-status": { title: "Bot-Status", description: "Verbindung, Datenbank und Laufzeitstatus" },
  commands: { title: "Commands", description: "Slash-Commands und Berechtigungen" },
  settings: { title: "Einstellungen", description: "Anwendung-, Modul- und Sync-Einstellungen" },
  logs: { title: "Aktivitäten", description: "Discord- und Systemereignisse" },
};
const endpoints: Record<string, string> = {
  tickets: "/api/tickets",
  moderation: "/api/moderation",
  logs: "/api/logs",
  servers: "/api/guilds",
};

function ModuleContent() {
  const params = useParams();
  const moduleName = String(params.module);
  const meta = titles[moduleName] || { title: moduleName, description: "Modulübersicht" };
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(Boolean(endpoints[moduleName]));

  useEffect(() => {
    if (endpoints[moduleName]) {
      fetch(endpoints[moduleName]).then((response) => response.ok ? response.json() : []).then(setRows).finally(() => setLoading(false));
    }
  }, [moduleName]);

  const dataModules = ["tickets", "servers", "moderation", "logs"];

  if (["members", "roles", "channels"].includes(moduleName)) {
    return (
      <section className="grid min-h-72 place-items-center rounded-xl border border-white/[0.06] bg-[#11151d] px-6 text-center">
        <div>
          <h1 className="text-xl font-semibold text-white">Diese Verwaltung wurde entfernt</h1>
          <p className="mt-2 text-sm text-slate-400">Für Clan-Rollen und Mitglieder nutze das Clan-Panel.</p>
          <Link href="/clans" className="mt-4 inline-flex rounded-lg bg-violet-600 px-4 py-2 text-sm text-white hover:bg-violet-500">Clan-Panel öffnen</Link>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <div><p className="mb-1 text-sm text-slate-500">{meta.title}</p><h1 className="text-2xl font-semibold">{meta.title}</h1><p className="mt-2 text-sm text-slate-500">{meta.description}</p></div>
      {["analytics", "commands", "settings", "bot-status"].includes(moduleName) && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 text-sm text-amber-200">
          Diese Integration wartet auf Discord-Sync oder zusätzliche Konfiguration. Es werden keine erfundenen Daten angezeigt.
        </div>
      )}
      {dataModules.includes(moduleName) ? (
        <section className="overflow-hidden rounded-xl border border-white/[0.06] bg-[#11151d]">
          <div className="flex items-center border-b border-white/[0.06] px-4 py-3">
            <Search size={16} className="text-slate-600" />
            <span className="ml-2 text-sm text-slate-600">Lokale Daten durchsuchen</span>
            <span className="ml-auto text-xs text-slate-600">{rows.length} Einträge</span>
          </div>
          {loading ? <div className="py-16 text-center text-sm text-slate-500">Laden...</div> : rows.length === 0 ? (
            <div className="grid min-h-72 place-items-center px-6 text-center"><div><Database size={28} className="mx-auto mb-3 text-slate-700" /><p className="text-sm text-slate-400">Noch keine Daten vorhanden</p></div></div>
          ) : (
            <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-slate-500"><tr>{Object.keys(rows[0]).slice(0, 6).map((key) => <th key={key} className="px-4 py-3">{key}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index} className="border-t border-white/[0.05]">{Object.keys(rows[0]).slice(0, 6).map((key) => <td key={key} className="max-w-64 px-4 py-3 text-slate-400">{String(row[key] ?? "—")}</td>)}</tr>)}</tbody></table></div>
          )}
        </section>
      ) : (
        <section className="grid min-h-72 place-items-center rounded-xl border border-white/[0.06] bg-[#11151d] text-center">
          <div><Database size={30} className="mx-auto mb-3 text-slate-700" /><p className="text-sm text-slate-400">{meta.title} wird nach erfolgreicher Discord-Verbindung geladen</p></div>
        </section>
      )}
    </div>
  );
}

export default function ModulePage() {
  return (
    <Suspense fallback={<div className="min-h-72 rounded-xl border border-white/[0.06] bg-[#11151d] p-6 text-sm text-slate-500">Modul wird geladen...</div>}>
      <ModuleContent />
    </Suspense>
  );
}
