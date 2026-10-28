"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Cards";
import { api } from "@/lib/client";
import type { Employee } from "@/lib/desk/types";

const inputCls = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#0b5fc1] focus:ring-2 focus:ring-blue-100";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
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
      <section className="hidden flex-col justify-between bg-[#151d2e] p-12 text-white lg:flex">
        <Logo dark />
        <div>
          <p className="text-xs text-slate-400">Service desk de TI da Nexo</p>
          <h1 className="mt-3 max-w-md font-serif text-5xl leading-tight">Seu problema de TI, resolvido em uma conversa.</h1>
          <p className="mt-5 max-w-sm text-sm text-slate-400">
            Descreva o que está acontecendo. O assistente consulta seus chamados, busca na central de ajuda e chama um analista quando precisa.
          </p>
          <div className="mt-10 max-w-md space-y-2 rounded-2xl bg-white/5 p-5 text-xs">
            <p className="ml-auto w-fit rounded-lg bg-white px-3 py-1.5 text-slate-900">Meu notebook não conecta na VPN. Erro 809.</p>
            <p className="text-slate-400"><b className="text-white">Nexo Assist</b> consultou seus chamados · criou um chamado</p>
            <p className="rounded-lg bg-white/10 px-3 py-2">Pronto: abri o chamado com prioridade alta. Um analista fala com você em até 4 h úteis.</p>
            <p className="w-fit rounded-full bg-white px-3 py-1 text-slate-900"><span className="mr-1 text-amber-500">●</span><b>INC-20517</b> Rede e VPN · Alta · em até 4 h</p>
          </div>
        </div>
        <div className="flex gap-10 border-t border-white/10 pt-6">
          {[["8 s", "primeira resposta, em média"], ["72%", "resolvidos sem fila"], ["6", "analistas online agora"]].map(([n, l]) => (
            <div key={l}><p className="font-serif text-3xl">{n}</p><p className="text-[11px] text-slate-400">{l}</p></div>
          ))}
        </div>
      </section>

      <section className="flex flex-col bg-white">
        <p className="p-6 text-right text-xs text-slate-500">Problema para entrar? <span className="font-medium text-[#0b5fc1]">Ligue no ramal 4000</span></p>
        <div className="flex flex-1 items-center justify-center px-8">
          <form onSubmit={submit} className="w-full max-w-sm space-y-4">
            <div>
              <h2 className="font-serif text-3xl">Entrar</h2>
              <p className="mt-1 text-sm text-slate-500">Use seu e-mail corporativo e a senha da rede Nexo.</p>
            </div>
            <label className="block text-xs text-slate-600">
              E-mail corporativo
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome.sobrenome@nexo.com.br" className={inputCls} />
            </label>
            <label className="block text-xs text-slate-600">
              <span className="flex justify-between">Senha <span className="text-[#0b5fc1]">Esqueci minha senha</span></span>
              <span className="relative block">
                <input type={show ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
                <button type="button" onClick={() => setShow(!show)} aria-label="Mostrar senha" className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{show ? "ocultar" : "ver"}</button>
              </span>
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" defaultChecked /> Manter conectado neste computador</label>
            {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <button disabled={loading} className="w-full rounded-lg bg-[#0b5fc1] py-2.5 text-sm font-medium text-white hover:bg-[#094e9e] disabled:opacity-60">{loading ? "Entrando..." : "Entrar →"}</button>
            <p className="border-t border-slate-100 pt-3 text-[11px] text-slate-400">
              Demo (senha nexo123): ana.souza@nexo.com.br (funcionária), diego.alves@nexo.com.br (analista)
            </p>
          </form>
        </div>
        <p className="flex justify-between p-6 text-[11px] text-slate-400"><span>© 2026 Nexo · Service desk de TI</span><span>Privacidade e uso de dados</span></p>
      </section>
    </main>
  );
}
