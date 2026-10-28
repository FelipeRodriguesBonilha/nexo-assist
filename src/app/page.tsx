"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import type { Employee } from "@/lib/desk/types";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const go = (e: Employee) => router.replace(e.role === "analyst" ? "/console" : "/chat");

  useEffect(() => {
    api<{ employee: Employee | null }>("/api/auth").then((r) => r.employee && go(r.employee)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setLoading(true);
    setError(null);
    try {
      go((await api<{ employee: Employee }>("/api/auth", { method: "POST", body: JSON.stringify({ email, password }) })).employee);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao entrar.");
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden flex-col justify-center bg-indigo-700 p-16 text-white lg:flex">
        <h1 className="text-4xl font-bold">Nexo Assist</h1>
        <p className="mt-3 max-w-md text-lg text-indigo-100">O agent do service desk de TI. Tire dúvidas, abra e acompanhe chamados numa conversa só.</p>
        <ul className="mt-8 space-y-2 text-indigo-100">
          <li>• Respostas imediatas da central de ajuda</li>
          <li>• Chamados criados só depois da sua confirmação</li>
          <li>• Um analista assume quando for preciso</li>
        </ul>
      </section>
      <section className="flex items-center justify-center p-8">
        <form onSubmit={submit} className="w-full max-w-sm space-y-4">
          <h2 className="text-2xl font-semibold">Entrar</h2>
          <label className="block text-sm">
            E-mail corporativo
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome.sobrenome@nexo.com"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500" />
          </label>
          <label className="block text-sm">
            Senha
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500" />
          </label>
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button disabled={loading} className="w-full rounded-lg bg-indigo-600 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
            {loading ? "Entrando..." : "Entrar"}
          </button>
          <p className="text-xs text-slate-500">
            Demo: ana.souza@nexo.com (funcionária) ou diego.alves@nexo.com (analista). Senha: nexo123
          </p>
        </form>
      </section>
    </main>
  );
}
