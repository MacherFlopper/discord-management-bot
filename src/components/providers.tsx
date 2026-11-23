"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";
import { DashboardShell } from "@/components/dashboard-shell";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <DashboardShell>{children}</DashboardShell>
    </SessionProvider>
  );
}
