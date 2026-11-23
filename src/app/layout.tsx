import type { Metadata } from "next";
import "./globals.css";
import { DashboardShell } from "@/components/dashboard-shell";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "Discord Control Hub",
  description: "Discord server administration dashboard",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="de"
      className="h-full antialiased"
    >
      <body className="min-h-full">
        <Providers>
          <DashboardShell>{children}</DashboardShell>
        </Providers>
      </body>
    </html>
  );
}
