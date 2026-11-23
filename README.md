# Discord Control Hub

Discord.js bot and responsive Next.js dashboard backed by SQLite.

## Start locally

1. Copy `.env.example` to `.env.local` and set `DISCORD_TOKEN`.
2. Run the dashboard with `npm run dev`.
3. Run the bot in a second terminal with `npm run bot`.

The bot needs the Server Members intent for member synchronization and these Discord permissions:

- Manage Roles for clan-role join/leave
- Manage Channels, View Channels, Send Messages and Read Message History for tickets
- View Channels and Send Messages for welcome messages

## Clan roles

Clans are ordinary Discord roles. Create the role in Discord, then register it in the dashboard under **Clans**. Roles with administrator or moderation permissions are rejected. Members can use `/clan join rolle:<role>` and `/clan leave rolle:<role>`. The bot role must be higher than each clan role in the Discord role hierarchy.

## Ticket panels

Create multiple panels under **Tickets & Panels**, choosing a panel channel, optional ticket category, support role, message and button text. Use `/ticketpanel panel_id:<id>` in Discord to publish a panel. Its button creates a private ticket channel; the creator, configured support role and bot can access it. The ticket creator, support team or a server administrator can close it.

## Settings and status

The settings page stores a welcome channel and message per server. Supported placeholders: `{user}`, `{username}`, `{server}`, `{memberCount}`. Bot Status and Slash-Commands display the current heartbeat and commands synced from Discord.

## Security

This local dashboard does not yet include Discord OAuth2 or dashboard authorization. Do not expose it publicly until authentication and authorization have been added. Keep `.env.local` private; bot tokens must never be committed.
