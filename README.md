# Discord Control Hub

Discord.js bot and responsive Next.js dashboard backed by SQLite.

## Start locally

1. Copy `.env.example` to `.env.local`.
2. Set `AUTH_DISCORD_ID`, `AUTH_DISCORD_SECRET`, and `AUTH_SECRET`. Create an OAuth application in the Discord Developer Portal, enable the `identify` and `guilds` scopes, and add this redirect URL: `http://localhost:3000/api/auth/callback/discord`.
   Generate `AUTH_SECRET` with `openssl rand -base64 32`.
3. Set `DISCORD_TOKEN` for the bot.
4. Run the dashboard with `npm run dev`.
5. Run the bot in a second terminal with `npm run bot`.

The bot needs the Server Members intent for member synchronization and these Discord permissions:

- Manage Roles for clan-role join/leave
- Manage Channels, View Channels, Send Messages and Read Message History for tickets
- View Channels and Send Messages for welcome messages
- View Channels and Send Messages in the configured price-announcement channel

## Clan roles

Clans are ordinary Discord roles. Create the role in Discord, then register it in the dashboard under **Clans**. Roles with administrator or moderation permissions are rejected. Members can use `/clan join rolle:<role>` and `/clan leave rolle:<role>`. The bot role must be higher than each clan role in the Discord role hierarchy.

Clan entry prices use the live role-member count: the next place is `member count + 1`; places 1–5 cost 10,000,000 each, and place 6 onward costs 20,000,000 each. The dashboard refreshes member totals automatically. Discounts from 1–99% require an expiry time and are announced when enabled, removed, or expired. Use `/clanpreise` for the current values; payment destination is `axxinde`.

## Spawner prices

The **Preislisten** dashboard panel starts with the Skelett, Creeper, Eisengolem, Spinne, Blaze, Kuh and Piglin prices from the supplied list. Select a Discord announcement channel to publish the complete styled **MACHER CLAN** price list with **Preisliste senden**. Price changes post both a before/after comparison and the new complete list. Use `/spawnerpreise` to post the current list publicly in Discord.

## Ticket panels

Create multiple panels under **Tickets & Panels**, choosing a panel channel, optional ticket category, support role, message and button text. Use `/ticketpanel panel_id:<id>` in Discord to publish a panel. Its button creates a private ticket channel; the creator, configured support role and bot can access it. The ticket creator, support team or a server administrator can close it.

## Settings and status

The settings page stores a welcome channel and message per server. Supported placeholders: `{user}`, `{username}`, `{server}`, `{memberCount}`. Bot Status and Slash-Commands display the current heartbeat and commands synced from Discord.

## Security

The dashboard requires Discord OAuth2 sign-in. Only Discord servers where the signed-in user is the owner or has Administrator/Manage Server permission are available, and every API request enforces that check server-side. Sessions expire after eight hours. Mutating API requests also require a same-origin `Origin` header.

For deployment, use HTTPS, set `AUTH_URL` and `NEXT_PUBLIC_APP_URL` to the public dashboard origin, and configure the identical OAuth callback URL (`https://your-domain/api/auth/callback/discord`) in the Discord Developer Portal. Keep all secrets in the host's environment-variable settings; never commit `.env.local`, `AUTH_SECRET`, OAuth credentials, or the bot token.

Authentication does not make the current SQLite deployment suitable for multiple or ephemeral hosting instances. Move the database to persistent shared storage (preferably PostgreSQL) and run the bot as a separate persistent worker before scaling or using serverless hosting.
