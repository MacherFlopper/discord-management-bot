import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, Client, EmbedBuilder,
  GatewayIntentBits, Partials, PermissionsBitField, SlashCommandBuilder,
  type ButtonInteraction, type ChatInputCommandInteraction, type Guild,
} from "discord.js";
import { getDb } from "../lib/db";
import { randomUUID } from "node:crypto";

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error("DISCORD_TOKEN fehlt.");
  process.exit(1);
}

const db = getDb();
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember],
});

function addLog(guildId: string | null, eventType: string, actorId?: string | null, details?: string | null, channelId?: string | null) {
  db.prepare(`
    INSERT INTO logs (guild_id, event_type, actor_id, actor_name, channel_id, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(guildId, eventType, actorId || null, null, channelId || null, details || null, new Date().toISOString());
}

function updateBotStatus(state: "online" | "offline" | "reconnecting") {
  db.prepare(`
    INSERT INTO bot_status (id, state, bot_name, guild_count, last_seen_at)
    VALUES (1, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET state=excluded.state, bot_name=excluded.bot_name,
      guild_count=excluded.guild_count, last_seen_at=excluded.last_seen_at
  `).run(state, client.user?.tag || null, client.guilds.cache.size, new Date().toISOString());
}

async function syncGuild(guildId: string) {
  const guild = await client.guilds.fetch(guildId);
  await guild.fetch();
  const roles = await guild.roles.fetch();
  const channels = await guild.channels.fetch();
  let members: Awaited<ReturnType<typeof guild.members.fetch>> | undefined;
  try {
    members = await guild.members.fetch();
  } catch (error) {
    addLog(guild.id, "member_sync_error", client.user?.id, error instanceof Error ? error.message : String(error));
    console.error(`Mitgliedersync fehlgeschlagen (${guild.id}); synchronisiere Rollen und Channels weiter:`, error);
  }

  db.prepare(`
    INSERT INTO guilds (id, name, icon, owner_id, member_count, bot_count, role_count, channel_count, boost_count, boost_level, last_synced_at, raw_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name, icon=excluded.icon, owner_id=excluded.owner_id,
      member_count=excluded.member_count, bot_count=excluded.bot_count, role_count=excluded.role_count,
      channel_count=excluded.channel_count, boost_count=excluded.boost_count, boost_level=excluded.boost_level,
      last_synced_at=excluded.last_synced_at, raw_json=excluded.raw_json
  `).run(
    guild.id, guild.name, guild.icon, guild.ownerId,
    guild.memberCount, members ? [...members.values()].filter((m) => m.user.bot).length : 0,
    roles.size, channels.size, guild.premiumSubscriptionCount || 0, guild.premiumTier,
    new Date().toISOString(), JSON.stringify({ description: guild.description, locale: guild.preferredLocale, features: guild.features }),
  );

  const insertRole = db.prepare(`
    INSERT INTO roles (guild_id, id, name, color, position, permissions, hoist, mentionable, managed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertChannel = db.prepare(`
    INSERT INTO channels (guild_id, id, name, type, position, parent_id, topic, nsfw, rate_limit_per_user)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.exec("BEGIN");
  try {
    db.prepare("DELETE FROM roles WHERE guild_id = ?").run(guild.id);
    db.prepare("DELETE FROM channels WHERE guild_id = ?").run(guild.id);
    for (const role of roles.values()) {
      insertRole.run(guild.id, role.id, role.name, role.color, role.position, role.permissions.bitfield.toString(),
        role.hoist ? 1 : 0, role.mentionable ? 1 : 0, role.managed ? 1 : 0);
    }
    for (const channel of channels.values()) {
      if (!channel) continue;
      insertChannel.run(guild.id, channel.id, channel.name, channel.type, channel.position,
        channel.parentId || null, "topic" in channel ? channel.topic : null,
        "nsfw" in channel && channel.nsfw ? 1 : 0,
        "rateLimitPerUser" in channel ? channel.rateLimitPerUser : 0);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  db.prepare("DELETE FROM clan_roles WHERE guild_id = ? AND role_id NOT IN (SELECT id FROM roles WHERE guild_id = ?)").run(guild.id, guild.id);

  for (const member of members?.values() || []) {
    db.prepare(`
      INSERT INTO members (guild_id, id, username, display_name, avatar, bot, joined_at, roles_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(guild_id, id) DO UPDATE SET username=excluded.username, display_name=excluded.display_name,
        avatar=excluded.avatar, bot=excluded.bot, joined_at=excluded.joined_at, roles_json=excluded.roles_json
    `).run(guild.id, member.id, member.user.username, member.displayName, member.user.avatar,
      member.user.bot ? 1 : 0, member.joinedAt?.toISOString() || null, JSON.stringify([...member.roles.cache.keys()].filter((id) => id !== guild.id)));
  }

  addLog(guild.id, "guild_sync", client.user?.id, "Serverdaten synchronisiert");
}

const clanCommand = new SlashCommandBuilder()
  .setName("clan")
  .setDescription("Tritt einer Clan-Rolle bei oder verlasse sie")
  .addSubcommand((command) => command.setName("join").setDescription("Erhalte eine registrierte Clan-Rolle")
    .addRoleOption((option) => option.setName("rolle").setDescription("Clan-Rolle").setRequired(true)))
  .addSubcommand((command) => command.setName("leave").setDescription("Gib eine Clan-Rolle ab")
    .addRoleOption((option) => option.setName("rolle").setDescription("Clan-Rolle").setRequired(true)));

const ticketPanelCommand = new SlashCommandBuilder()
  .setName("ticketpanel")
  .setDescription("Veröffentlicht ein Ticket-Panel in seinem konfigurierten Channel")
  .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
  .addStringOption((option) => option.setName("panel_id").setDescription("Panel-ID aus dem Dashboard").setRequired(true));

const syncCommand = new SlashCommandBuilder()
  .setName("sync")
  .setDescription("Synchronisiert Serverdaten und Slash-Commands")
  .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild);

const serverInfoCommand = new SlashCommandBuilder()
  .setName("serverinfo")
  .setDescription("Zeigt Informationen über diesen Discord-Server");

const userInfoCommand = new SlashCommandBuilder()
  .setName("userinfo")
  .setDescription("Zeigt Informationen über einen Benutzer")
  .addUserOption((option) => option.setName("benutzer").setDescription("Discord-Benutzer").setRequired(false));

async function syncApplicationCommands(guild: Guild) {
  const commands = await guild.commands.fetch();
  const legacyClanCommand = commands.find((command) =>
    command.name === "clanhub" && command.description === "Verwalte Clans auf diesem Server",
  );
  if (legacyClanCommand) await guild.commands.delete(legacyClanCommand.id);

  for (const commandData of [clanCommand.toJSON(), ticketPanelCommand.toJSON(), syncCommand.toJSON(), serverInfoCommand.toJSON(), userInfoCommand.toJSON()]) {
    const existing = commands.find((command) => command.name === commandData.name);
    if (!existing) {
      await guild.commands.create(commandData);
    } else if (existing.description === commandData.description) {
      await guild.commands.edit(existing.id, commandData);
    } else {
      console.error(`/${commandData.name} ist bereits durch einen anderen Befehl auf ${guild.name} belegt; nicht überschrieben.`);
    }
  }
  const syncedCommands = await guild.commands.fetch();
  const save = db.prepare(`
    INSERT INTO bot_commands (guild_id, command_id, name, description, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(guild_id, command_id) DO UPDATE SET name=excluded.name,
      description=excluded.description, updated_at=excluded.updated_at
  `);
  db.prepare("DELETE FROM bot_commands WHERE guild_id = ?").run(guild.id);
  for (const command of syncedCommands.values()) {
    save.run(guild.id, command.id, command.name, command.description, new Date().toISOString());
  }
  console.log(`Discord-Befehle für ${guild.name} synchronisiert.`);
}

async function handleClanCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId || !interaction.guild) throw new Error("Dieser Befehl funktioniert nur auf einem Server.");
  const selectedRole = interaction.options.getRole("rolle", true);
  const role = await interaction.guild.roles.fetch(selectedRole.id);
  if (!role) throw new Error("Die ausgewählte Discord-Rolle wurde nicht gefunden.");
  const registration = db.prepare("SELECT role_id FROM clan_roles WHERE guild_id = ? AND role_id = ?").get(interaction.guildId, role.id);
  if (!registration) throw new Error("Diese Rolle ist im Clan-Dashboard nicht als Clan-Rolle freigeschaltet.");
  if (role.managed || role.id === interaction.guild.id) throw new Error("Diese Rolle kann nicht als Clan-Rolle verwendet werden.");

  const botMember = await interaction.guild.members.fetchMe();
  if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
    throw new Error("Dem Bot fehlt die Berechtigung „Rollen verwalten“.");
  }
  if (role.position >= botMember.roles.highest.position) {
    throw new Error("Die Clan-Rolle muss in der Server-Rollenliste unter der Bot-Rolle stehen.");
  }

  const member = await interaction.guild.members.fetch(interaction.user.id);
  const joining = interaction.options.getSubcommand() === "join";
  if (joining && member.roles.cache.has(role.id)) {
    await interaction.reply({ content: `Du hast die Rolle **${role.name}** bereits.`, ephemeral: true });
    return;
  }
  if (!joining && !member.roles.cache.has(role.id)) {
    await interaction.reply({ content: `Du hast die Rolle **${role.name}** nicht.`, ephemeral: true });
    return;
  }

  if (joining) await member.roles.add(role, "Clan-Rolle über /clan join");
  else await member.roles.remove(role, "Clan-Rolle über /clan leave");
  addLog(interaction.guildId, joining ? "clan_role_join" : "clan_role_leave", member.id, role.name);
  await interaction.reply({
    content: joining ? `Du hast die Clan-Rolle **${role.name}** erhalten.` : `Du hast die Clan-Rolle **${role.name}** abgegeben.`,
    ephemeral: true,
  });
}

async function handleTicketPanelCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId || !interaction.guild) throw new Error("Dieser Befehl funktioniert nur auf einem Server.");
  if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) {
    throw new Error("Zum Veröffentlichen eines Ticket-Panels wird Server verwalten benötigt.");
  }
  const panelId = interaction.options.getString("panel_id", true);
  const panel = db.prepare("SELECT * FROM ticket_panels WHERE id = ? AND guild_id = ?").get(panelId, interaction.guildId) as
    | { id: string; name: string; title: string; description: string; panel_channel_id: string; button_label: string }
    | undefined;
  if (!panel) throw new Error("Ticket-Panel nicht gefunden. Prüfe die Panel-ID aus dem Dashboard.");
  const channel = await interaction.guild.channels.fetch(panel.panel_channel_id);
  if (!channel || !channel.isTextBased() || !("send" in channel)) {
    throw new Error("Der konfigurierte Panel-Channel ist nicht verfügbar.");
  }
  const message = await channel.send({
    embeds: [new EmbedBuilder().setColor(0x8057e8).setTitle(panel.title).setDescription(panel.description || `Erstelle ein Ticket für **${panel.name}**.`)],
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`ticket:open:${panel.id}`).setLabel(panel.button_label).setStyle(ButtonStyle.Primary),
    )],
  });
  addLog(interaction.guildId, "ticket_panel_published", interaction.user.id, `[${panel.name}] ${channel.id}`);
  await interaction.reply({ content: `Ticket-Panel wurde in ${channel} veröffentlicht.`, ephemeral: true });
  console.log(`Ticket-Panel ${panel.id} veröffentlicht (${message.id}).`);
}

async function handleTicketButton(interaction: ButtonInteraction) {
  if (!interaction.guildId || !interaction.guild) throw new Error("Tickets können nur auf einem Server geöffnet werden.");
  if (interaction.customId.startsWith("ticket:open:")) {
    const panelId = interaction.customId.slice("ticket:open:".length);
    const panel = db.prepare("SELECT * FROM ticket_panels WHERE id = ? AND guild_id = ?").get(panelId, interaction.guildId) as
      | { id: string; name: string; title: string; description: string; ticket_category_id: string | null; support_role_id: string | null }
      | undefined;
    if (!panel) throw new Error("Dieses Ticket-Panel ist nicht mehr verfügbar.");
    const existing = db.prepare(`
      SELECT channel_id FROM tickets
      WHERE guild_id = ? AND creator_id = ? AND panel_id = ? AND status IN ('open', 'in_progress', 'waiting')
      ORDER BY created_at DESC LIMIT 1
    `).get(interaction.guildId, interaction.user.id, panel.id) as { channel_id: string | null } | undefined;
    if (existing?.channel_id) {
      await interaction.reply({ content: `Du hast bereits ein offenes Ticket: <#${existing.channel_id}>`, ephemeral: true });
      return;
    }

    const safeUsername = interaction.user.username.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").slice(0, 40);
    const permissionOverwrites = [
      { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.AttachFiles] },
    ];
    if (client.user) {
      permissionOverwrites.push({
        id: client.user.id,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.ManageChannels],
      });
    }
    if (panel.support_role_id) {
      permissionOverwrites.push({
        id: panel.support_role_id,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
      });
    }

    const channel = await interaction.guild.channels.create({
      name: `ticket-${safeUsername || interaction.user.id.slice(-6)}`,
      type: ChannelType.GuildText,
      parent: panel.ticket_category_id || undefined,
      permissionOverwrites,
      reason: `Ticket von ${interaction.user.tag} über Panel ${panel.name}`,
    });
    const ticketId = randomUUID();
    const now = new Date().toISOString();
    try {
      db.prepare(`
        INSERT INTO tickets (id, guild_id, creator_id, creator_name, subject, category, status, panel_id, channel_id, support_role_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?)
      `).run(ticketId, interaction.guildId, interaction.user.id, interaction.user.globalName || interaction.user.username,
        panel.title, panel.name, panel.id, channel.id, panel.support_role_id, now, now);
      await channel.send({
        content: `${interaction.user} ${panel.support_role_id ? `<@&${panel.support_role_id}>` : ""}`.trim(),
        embeds: [new EmbedBuilder().setColor(0x8057e8).setTitle(panel.title).setDescription(panel.description || "Ein Support-Teammitglied wird sich zeitnah melden.")],
        components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId(`ticket:close:${ticketId}`).setLabel("Ticket schließen").setStyle(ButtonStyle.Secondary),
        )],
      });
    } catch (error) {
      await channel.delete("Ticket-Erstellung konnte nicht abgeschlossen werden.").catch((cleanupError: unknown) => {
        console.error(`Ticket-Channel ${channel.id} konnte nach Fehler nicht entfernt werden:`, cleanupError);
      });
      throw error;
    }
    addLog(interaction.guildId, "ticket_created", interaction.user.id, `[${panel.name}] ${channel.id}`, channel.id);
    await interaction.reply({ content: `Dein Ticket wurde erstellt: ${channel}`, ephemeral: true });
    return;
  }

  if (!interaction.customId.startsWith("ticket:close:")) return;
  const ticketId = interaction.customId.slice("ticket:close:".length);
  const ticket = db.prepare(`
    SELECT tickets.* FROM tickets WHERE tickets.id = ? AND tickets.guild_id = ?
  `).get(ticketId, interaction.guildId) as
    | { id: string; creator_id: string; status: string; channel_id: string | null; support_role_id: string | null }
    | undefined;
  if (!ticket) throw new Error("Ticket nicht gefunden.");
  if (ticket.status === "closed") throw new Error("Dieses Ticket ist bereits geschlossen.");
  const member = await interaction.guild.members.fetch(interaction.user.id);
  const canClose = ticket.creator_id === member.id
    || member.permissions.has(PermissionsBitField.Flags.ManageGuild)
    || Boolean(ticket.support_role_id && member.roles.cache.has(ticket.support_role_id));
  if (!canClose) throw new Error("Nur der Ticket-Ersteller, das Support-Team oder Server-Administratoren können schließen.");

  if (ticket.channel_id) {
    const channel = await interaction.guild.channels.fetch(ticket.channel_id);
    if (channel?.type === ChannelType.GuildText) {
      await channel.permissionOverwrites.edit(ticket.creator_id, { SendMessages: false });
      if (!channel.name.startsWith("closed-")) await channel.setName(`closed-${channel.name}`.slice(0, 100));
    }
  }
  db.prepare("UPDATE tickets SET status = 'closed', updated_at = ? WHERE id = ?")
    .run(new Date().toISOString(), ticket.id);
  addLog(interaction.guildId, "ticket_closed", interaction.user.id, ticket.id, ticket.channel_id);
  await interaction.reply({ content: "Ticket geschlossen.", ephemeral: true });
}

async function handleSyncCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId || !interaction.guild) throw new Error("Dieser Befehl funktioniert nur auf einem Server.");
  await interaction.deferReply({ ephemeral: true });
  await syncGuild(interaction.guildId);
  await syncApplicationCommands(interaction.guild);
  await interaction.editReply("Serverdaten und Slash-Commands wurden synchronisiert.");
}

async function handleServerInfoCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) throw new Error("Dieser Befehl funktioniert nur auf einem Server.");
  const owner = await interaction.guild.fetchOwner();
  const embed = new EmbedBuilder()
    .setColor(0x8057e8)
    .setTitle(interaction.guild.name)
    .setThumbnail(interaction.guild.iconURL({ size: 128 }))
    .addFields(
      { name: "Server-ID", value: interaction.guild.id, inline: true },
      { name: "Owner", value: `${owner.user.tag} (${owner.id})`, inline: true },
      { name: "Mitglieder", value: String(interaction.guild.memberCount), inline: true },
      { name: "Erstellt", value: `<t:${Math.floor(interaction.guild.createdTimestamp / 1000)}:R>`, inline: true },
    );
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleUserInfoCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) throw new Error("Dieser Befehl funktioniert nur auf einem Server.");
  const user = interaction.options.getUser("benutzer") || interaction.user;
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);
  const embed = new EmbedBuilder()
    .setColor(0x8057e8)
    .setTitle(user.tag)
    .setThumbnail(user.displayAvatarURL({ size: 128 }))
    .addFields(
      { name: "User-ID", value: user.id, inline: true },
      { name: "Bot", value: user.bot ? "Ja" : "Nein", inline: true },
      { name: "Discord beigetreten", value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
      { name: "Server beigetreten", value: member?.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : "Unbekannt", inline: true },
    );
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleChatCommand(interaction: ChatInputCommandInteraction) {
  if (interaction.commandName === "clan") return handleClanCommand(interaction);
  if (interaction.commandName === "ticketpanel") return handleTicketPanelCommand(interaction);
  if (interaction.commandName === "sync") return handleSyncCommand(interaction);
  if (interaction.commandName === "serverinfo") return handleServerInfoCommand(interaction);
  if (interaction.commandName === "userinfo") return handleUserInfoCommand(interaction);
}

client.once("clientReady", async () => {
  console.log(`Discord Bot angemeldet als ${client.user?.tag}`);
  updateBotStatus("online");
  setInterval(() => updateBotStatus("online"), 15_000);
  for (const guild of client.guilds.cache.values()) {
    await syncGuild(guild.id).catch((error) => console.error(`Sync fehlgeschlagen (${guild.id}):`, error));
    await syncApplicationCommands(guild).catch((error) => console.error(`Discord-Befehle konnten nicht synchronisiert werden (${guild.id}):`, error));
  }
});

client.on("shardDisconnect", () => updateBotStatus("offline"));
client.on("shardReconnecting", () => updateBotStatus("reconnecting"));
client.on("shardResume", () => updateBotStatus("online"));

client.on("guildCreate", (guild) => {
  syncGuild(guild.id).catch(console.error);
  syncApplicationCommands(guild).catch((error) => console.error(`Discord-Befehle konnten nicht synchronisiert werden (${guild.id}):`, error));
});
client.on("interactionCreate", async (interaction) => {
  const toolCommands = ["clan", "ticketpanel", "sync", "serverinfo", "userinfo"];
  const isToolCommand = interaction.isChatInputCommand() && toolCommands.includes(interaction.commandName);
  const isTicketButton = interaction.isButton() && interaction.customId.startsWith("ticket:");
  if (!isToolCommand && !isTicketButton) return;
  try {
    if (interaction.isButton()) await handleTicketButton(interaction);
    else if (interaction.isChatInputCommand()) await handleChatCommand(interaction);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Der Clan-Befehl ist fehlgeschlagen.";
    console.error("Discord-Interaktion fehlgeschlagen:", error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: message, ephemeral: true });
    } else {
      await interaction.reply({ content: message, ephemeral: true });
    }
  }
});
client.on("guildMemberAdd", (member) => {
  addLog(member.guild.id, "member_join", member.id, null);
  db.prepare(`
    INSERT INTO members (guild_id, id, username, display_name, avatar, bot, joined_at, roles_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(guild_id, id) DO UPDATE SET username=excluded.username, display_name=excluded.display_name,
      avatar=excluded.avatar, bot=excluded.bot, joined_at=excluded.joined_at, roles_json=excluded.roles_json
  `).run(member.guild.id, member.id, member.user.username, member.displayName, member.user.avatar,
    member.user.bot ? 1 : 0, member.joinedAt?.toISOString() || null, JSON.stringify([...member.roles.cache.keys()].filter((id) => id !== member.guild.id)));
  const settings = db.prepare("SELECT welcome_channel_id, welcome_message FROM settings WHERE guild_id = ?").get(member.guild.id) as
    | { welcome_channel_id: string | null; welcome_message: string | null }
    | undefined;
  const welcomeMessage = settings?.welcome_message;
  if (!settings?.welcome_channel_id || !welcomeMessage) return;
  member.guild.channels.fetch(settings.welcome_channel_id).then((channel) => {
    if (!channel?.isTextBased() || !("send" in channel)) {
      throw new Error(`Willkommens-Channel ${settings.welcome_channel_id} ist nicht verfügbar.`);
    }
    const message = welcomeMessage
      .replaceAll("{user}", `${member}`)
      .replaceAll("{username}", member.user.username)
      .replaceAll("{server}", member.guild.name)
      .replaceAll("{memberCount}", String(member.guild.memberCount));
    return channel.send({ content: message });
  }).catch((error: unknown) => {
    addLog(member.guild.id, "welcome_message_error", client.user?.id, error instanceof Error ? error.message : String(error), settings.welcome_channel_id);
    console.error(`Willkommensnachricht konnte in ${settings.welcome_channel_id} nicht gesendet werden:`, error);
  });
});
client.on("guildMemberRemove", (member) => {
  addLog(member.guild.id, "member_leave", member.id, null);
  db.prepare("DELETE FROM members WHERE guild_id = ? AND id = ?").run(member.guild.id, member.id);
});
client.on("messageCreate", (message) => {
  if (message.guild && !message.author.bot) addLog(message.guild.id, "message_create", message.author.id, null, message.channelId);
});
client.on("messageDelete", (message) => {
  if (message.guild) addLog(message.guild.id, "message_delete", message.author?.id, null, message.channelId);
});
client.on("guildMemberUpdate", (_oldMember, newMember) => {
  addLog(newMember.guild.id, "member_update", newMember.id, null);
  db.prepare("UPDATE members SET display_name = ?, roles_json = ? WHERE guild_id = ? AND id = ?")
    .run(newMember.displayName, JSON.stringify([...newMember.roles.cache.keys()].filter((id) => id !== newMember.guild.id)), newMember.guild.id, newMember.id);
});
client.on("roleCreate", (role) => syncGuild(role.guild.id).catch(console.error));
client.on("roleUpdate", (_oldRole, newRole) => syncGuild(newRole.guild.id).catch(console.error));
client.on("roleDelete", (role) => syncGuild(role.guild.id).catch(console.error));
client.on("channelCreate", (channel) => {
  if (channel.isDMBased()) return;
  syncGuild(channel.guild.id).catch(console.error);
});
client.on("channelUpdate", (_oldChannel, newChannel) => {
  if (newChannel.isDMBased()) return;
  syncGuild(newChannel.guild.id).catch(console.error);
});
client.on("channelDelete", (channel) => {
  if (channel.isDMBased()) return;
  syncGuild(channel.guild.id).catch(console.error);
});

client.login(token).catch((error) => {
  console.error("Discord-Anmeldung fehlgeschlagen:", error);
  process.exit(1);
});
