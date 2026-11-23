import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";

type DiscordGuild = {
  id: string;
  owner: boolean;
  permissions: string;
};

const administrator = BigInt(1) << BigInt(3);
const manageGuild = BigInt(1) << BigInt(5);
const sessionLifetime = 8 * 60 * 60 * 1000;

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Discord({
      authorization: {
        params: { scope: "identify guilds" },
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: sessionLifetime / 1000,
  },
  callbacks: {
    async jwt({ token, account }) {
      if (account?.provider === "discord" && account.access_token) {
        token.authExpiresAt = Date.now() + sessionLifetime;
        const response = await fetch("https://discord.com/api/users/@me/guilds", {
          headers: { Authorization: `Bearer ${account.access_token}` },
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`Discord guild authorization failed (${response.status}).`);
        }
        const guilds = await response.json() as DiscordGuild[];
        token.authorizedGuildIds = guilds
          .filter((guild) => {
            const permissions = BigInt(guild.permissions);
            return guild.owner || (permissions & (administrator | manageGuild)) !== BigInt(0);
          })
          .map((guild) => guild.id);
      }
      if (token.authExpiresAt && Date.now() >= token.authExpiresAt) return null;
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.authorizedGuildIds = token.authorizedGuildIds ?? [];
      }
      return session;
    },
    authorized({ auth: session }) {
      return Boolean(session?.user);
    },
  },
});
