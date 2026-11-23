import "next-auth";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      authorizedGuildIds: string[];
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    authorizedGuildIds?: string[];
    authExpiresAt?: number;
  }
}
