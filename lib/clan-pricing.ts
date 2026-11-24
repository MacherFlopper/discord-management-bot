import { getDb } from "./db";
import { calculateClanPrice } from "./pricing";

type ClanRow = {
  guild_id: string;
  role_id: string;
  created_at: string;
  guild_name: string;
  name: string;
  color: number;
  position: number;
  permissions: string;
  managed: number;
  configured_discount_percent: number | null;
  discount_expires_at: string | null;
};

type MemberRow = { guild_id: string; id: string; roles_json: string };

export function getClanPrices(guildIds: string[]) {
  if (!guildIds.length) return [];
  const placeholders = guildIds.map(() => "?").join(",");
  const db = getDb();
  const clans = db.prepare(`
    SELECT clan_roles.*, guilds.name AS guild_name, roles.name, roles.color, roles.position,
      roles.permissions, roles.managed, clan_discounts.discount_percent AS configured_discount_percent,
      clan_discounts.expires_at AS discount_expires_at
    FROM clan_roles
    JOIN guilds ON guilds.id = clan_roles.guild_id
    JOIN roles ON roles.guild_id = clan_roles.guild_id AND roles.id = clan_roles.role_id
    LEFT JOIN clan_discounts ON clan_discounts.guild_id = clan_roles.guild_id
      AND clan_discounts.role_id = clan_roles.role_id
    WHERE clan_roles.guild_id IN (${placeholders})
    ORDER BY guild_name, roles.position DESC
  `).all(...guildIds) as ClanRow[];
  const members = db.prepare(`
    SELECT guild_id, id, roles_json FROM members
    WHERE guild_id IN (${placeholders}) AND bot = 0
  `).all(...guildIds) as MemberRow[];
  const counts = new Map<string, number>();

  for (const member of members) {
    let roleIds: unknown;
    try {
      roleIds = JSON.parse(member.roles_json);
    } catch (error) {
      console.error(`Invalid member role cache for ${member.guild_id}/${member.id}:`, error);
      continue;
    }
    if (!Array.isArray(roleIds) || !roleIds.every((roleId) => typeof roleId === "string")) {
      console.error(`Invalid member role cache for ${member.guild_id}/${member.id}.`);
      continue;
    }
    for (const roleId of roleIds) {
      const key = `${member.guild_id}:${roleId}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }

  const now = Date.now();
  return clans.map((clan) => {
    const memberCount = counts.get(`${clan.guild_id}:${clan.role_id}`) || 0;
    const discountActive = Boolean(
      clan.configured_discount_percent
      && clan.discount_expires_at
      && Date.parse(clan.discount_expires_at) > now,
    );
    const discountPercent = discountActive ? clan.configured_discount_percent || 0 : 0;
    const pricing = calculateClanPrice(memberCount, discountPercent);
    return {
      ...clan,
      member_count: memberCount,
      discount_active: discountActive,
      discount_percent: discountPercent,
      place: pricing.place,
      base_price: pricing.basePrice,
      current_price: pricing.currentPrice,
    };
  });
}
