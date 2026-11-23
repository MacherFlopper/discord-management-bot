import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";

declare global {
  var __controlPanelDb: DatabaseSync | undefined;
}

export function getDb() {
  if (globalThis.__controlPanelDb) return globalThis.__controlPanelDb;

  const configured = process.env.DATABASE_PATH || "./data/control-panel.sqlite";
  const filename = path.resolve(process.cwd(), configured);
  fs.mkdirSync(path.dirname(filename), { recursive: true });

  const db = new DatabaseSync(filename);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS guilds (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT,
      owner_id TEXT,
      member_count INTEGER NOT NULL DEFAULT 0,
      bot_count INTEGER NOT NULL DEFAULT 0,
      role_count INTEGER NOT NULL DEFAULT 0,
      channel_count INTEGER NOT NULL DEFAULT 0,
      boost_count INTEGER NOT NULL DEFAULT 0,
      boost_level INTEGER NOT NULL DEFAULT 0,
      last_synced_at TEXT,
      raw_json TEXT
    );

    CREATE TABLE IF NOT EXISTS members (
      guild_id TEXT NOT NULL,
      id TEXT NOT NULL,
      username TEXT NOT NULL,
      display_name TEXT,
      avatar TEXT,
      bot INTEGER NOT NULL DEFAULT 0,
      joined_at TEXT,
      roles_json TEXT NOT NULL DEFAULT '[]',
      PRIMARY KEY (guild_id, id),
      FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS roles (
      guild_id TEXT NOT NULL,
      id TEXT NOT NULL,
      name TEXT NOT NULL,
      color INTEGER NOT NULL DEFAULT 0,
      position INTEGER NOT NULL DEFAULT 0,
      permissions TEXT NOT NULL,
      hoist INTEGER NOT NULL DEFAULT 0,
      mentionable INTEGER NOT NULL DEFAULT 0,
      managed INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (guild_id, id),
      FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS channels (
      guild_id TEXT NOT NULL,
      id TEXT NOT NULL,
      name TEXT NOT NULL,
      type INTEGER NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      parent_id TEXT,
      topic TEXT,
      nsfw INTEGER NOT NULL DEFAULT 0,
      rate_limit_per_user INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (guild_id, id),
      FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      guild_id TEXT NOT NULL,
      creator_id TEXT,
      creator_name TEXT,
      subject TEXT NOT NULL,
      category TEXT,
      priority TEXT NOT NULL DEFAULT 'normal',
      status TEXT NOT NULL DEFAULT 'open',
      assignee_id TEXT,
      assignee_name TEXT,
      panel_id TEXT,
      channel_id TEXT,
      support_role_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS moderation_cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      target_id TEXT,
      target_name TEXT,
      moderator_id TEXT,
      moderator_name TEXT,
      action TEXT NOT NULL,
      reason TEXT,
      duration TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT,
      event_type TEXT NOT NULL,
      actor_id TEXT,
      actor_name TEXT,
      channel_id TEXT,
      details TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      guild_id TEXT PRIMARY KEY,
      welcome_channel_id TEXT,
      welcome_message TEXT,
      module_config_json TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL,
      FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bot_status (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      state TEXT NOT NULL,
      bot_name TEXT,
      guild_count INTEGER NOT NULL DEFAULT 0,
      last_seen_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS clan_roles (
      guild_id TEXT NOT NULL,
      role_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (guild_id, role_id),
      FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ticket_panels (
      id TEXT PRIMARY KEY,
      guild_id TEXT NOT NULL,
      name TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      panel_channel_id TEXT NOT NULL,
      ticket_category_id TEXT,
      support_role_id TEXT,
      button_label TEXT NOT NULL DEFAULT 'Ticket erstellen',
      panel_config_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bot_commands (
      guild_id TEXT NOT NULL,
      command_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (guild_id, command_id),
      FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_members_guild ON members(guild_id);
    CREATE INDEX IF NOT EXISTS idx_roles_guild ON roles(guild_id);
    CREATE INDEX IF NOT EXISTS idx_channels_guild ON channels(guild_id);
    CREATE INDEX IF NOT EXISTS idx_clan_roles_guild ON clan_roles(guild_id);
    CREATE INDEX IF NOT EXISTS idx_ticket_panels_guild ON ticket_panels(guild_id);
    CREATE INDEX IF NOT EXISTS idx_tickets_guild_status ON tickets(guild_id, status);
    CREATE INDEX IF NOT EXISTS idx_logs_guild_created ON logs(guild_id, created_at);
  `);

  const panelColumns = db.prepare("PRAGMA table_info(ticket_panels)").all() as { name: string }[];
  if (!panelColumns.some((column) => column.name === "panel_config_json")) {
    db.exec("ALTER TABLE ticket_panels ADD COLUMN panel_config_json TEXT NOT NULL DEFAULT '{}'");
  }

  const ticketColumns = db.prepare("PRAGMA table_info(tickets)").all() as { name: string }[];
  if (!ticketColumns.some((column) => column.name === "panel_id")) {
    db.exec("ALTER TABLE tickets ADD COLUMN panel_id TEXT");
  }
  if (!ticketColumns.some((column) => column.name === "channel_id")) {
    db.exec("ALTER TABLE tickets ADD COLUMN channel_id TEXT");
  }
  if (!ticketColumns.some((column) => column.name === "support_role_id")) {
    db.exec("ALTER TABLE tickets ADD COLUMN support_role_id TEXT");
  }
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ticket_active_per_user_panel
      ON tickets(guild_id, creator_id, panel_id)
      WHERE panel_id IS NOT NULL AND status IN ('open', 'in_progress', 'waiting')
  `);

  globalThis.__controlPanelDb = db;
  return db;
}

