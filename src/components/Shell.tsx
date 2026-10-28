"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "./Cards";
import { api } from "@/lib/client";
import type { Employee } from "@/lib/desk/types";

export const initials = (name: string) => name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

export function Shell({ me, active, title, right, side, children }: {
  me: Employee | null; active: "chat" | "perfil"; title: string; right?: React.ReactNode; side?: React.ReactNode; children: React.ReactNode;
}) {
  const router = useRouter();
  const item = (href: string, label: string, on: boolean) => (
    <Link href={href} className={`block rounded-lg px-3 py-2 text-sm ${on ? "bg-blue-50 font-medium text-[#0b5fc1]" : "text-slate-600 hover:bg-slate-100"}`}>{label}</Link>
  );
  return (
    <div className="flex h-screen bg-white">
      <aside className="hidden w-60 flex-col border-r border-slate-200 md:flex">
        <div className="p-4"><Logo /></div>
        <nav className="space-y-1 px-3">
          {item("/chat", "Atendimento", active === "chat")}
          {item("/perfil", "Meu perfil", active === "perfil")}
        </nav>
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto px-3">{side}</div>
        <div className="border-t border-slate-100 p-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-[#0b5fc1]">{me ? initials(me.name) : ""}</span>
            <div className="min-w-0 text-xs"><p className="truncate font-semibold">{me?.name}</p><p className="truncate text-slate-500">{me?.email}</p></div>
          </div>
          <button onClick={async () => { await api("/api/auth", { method: "DELETE" }); router.replace("/"); }} className="mt-3 text-xs text-slate-500 hover:underline">⇥ Sair</button>
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-100 px-8 py-3 text-xs text-slate-500">
          <p>Service desk de TI <span className="mx-1">›</span> <span className="font-semibold text-slate-900">{title}</span></p>
          {right}
        </header>
        {children}
      </main>
    </div>
  );
}
