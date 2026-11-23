"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export default function LoginPage() {
  const [isSigningIn, setIsSigningIn] = useState(false);

  return (
    <main className="grid min-h-screen place-items-center bg-[#090b10] p-6 text-slate-100">
      <section className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#0d1017] p-8 text-center shadow-2xl shadow-black/30">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-violet-600 text-lg font-bold">CH</div>
        <h1 className="mt-6 text-2xl font-semibold">Discord Control Hub</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Melde dich mit Discord an. Du kannst nur Server verwalten, für die du Administrator- oder Server-verwalten-Rechte hast.
        </p>
        <button
          className="mt-7 w-full rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold transition hover:bg-violet-500 disabled:cursor-wait disabled:opacity-60"
          disabled={isSigningIn}
          onClick={async () => {
            setIsSigningIn(true);
            await signIn("discord", { redirectTo: "/" });
          }}
        >
          {isSigningIn ? "Weiterleitung zu Discord..." : "Mit Discord anmelden"}
        </button>
      </section>
    </main>
  );
}
