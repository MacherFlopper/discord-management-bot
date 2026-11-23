export function discordGuildIcon(guildId: string, icon: string | null) {
  if (!icon) return null;
  return `https://cdn.discordapp.com/icons/${guildId}/${icon}.png`;
}

export function discordAvatar(userId: string, avatar: string | null) {
  if (!avatar) return `https://cdn.discordapp.com/embed/avatars/${Number.parseInt(userId.slice(-1), 10) % 5}.png`;
  return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.png`;
}
