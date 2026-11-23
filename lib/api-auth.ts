import { NextResponse } from "next/server";
import { auth } from "../auth";

type Authorization =
  | { ok: true; guildIds: string[] }
  | { ok: false; response: NextResponse };

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    const requestOrigin = new URL(request.url).origin;
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",", 1)[0]?.trim();
    const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",", 1)[0]?.trim() || "https";
    const forwardedOrigin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : null;
    const configuredOrigins = [
      requestOrigin,
      forwardedOrigin,
      process.env.AUTH_URL,
      process.env.NEXT_PUBLIC_APP_URL,
    ].filter((value): value is string => Boolean(value)).map((value) => new URL(value).origin);

    return configuredOrigins.includes(new URL(origin).origin);
  } catch {
    return false;
  }
}

export async function authorizeDashboardRequest(
  request: Request,
  guildId?: string | null,
): Promise<Authorization> {
  if (request.method !== "GET" && !isSameOrigin(request)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Ungültige Anfragequelle." }, { status: 403 }),
    };
  }

  const session = await auth();
  if (!session?.user?.id) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Anmeldung erforderlich." }, { status: 401 }),
    };
  }

  const guildIds = session.user.authorizedGuildIds ?? [];
  if (guildId && !guildIds.includes(guildId)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Keine Berechtigung für diesen Discord-Server." }, { status: 403 }),
    };
  }

  return { ok: true, guildIds };
}
