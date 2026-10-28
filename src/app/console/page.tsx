"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PartView, ago } from "@/components/Cards";
import { initials } from "@/components/Shell";
import { api, fmtTime } from "@/lib/client";
import { isOpen } from "@/lib/desk/tickets-shared";
import type { Conversation, Employee, Message, Ticket } from "@/lib/desk/types";

type Row = Conversation & { employeeName: string; lastMessage: string };
interface Detail { conversation: Conversation; employee: Employee; messages: Message[]; tickets: Ticket[] }
type Filter = "all" | "mine_queue" | "agent" | "mine";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "mine_queue", label: "Para você" },
  { value: "agent", label: "Com o agent" },
  { value: "mine", label: "Minhas" },
];

export default function ConsolePage() {
  const router = useRouter();
  const [me, setMe] = useState<Employee | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadList = useCallback(() => api<{ conversations: Row[] }>("/api/console/conversations").then((r) => setRows(r.conversations)).catch((e: Error) => setError(e.message)), []);
  const loadDetail = useCallback((id: string) => api<Detail>(`/api/console/conversations/${id}`).then(setDetail).catch((e: Error) => setError(e.message)), []);

  useEffect(() => {
    api<{ employee: Employee | null }>("/api/auth").then(({ employee }) => {
      if (!employee) return router.replace("/");
      if (employee.role !== "analyst") return router.replace("/chat");
      setMe(employee);
    });
  }, [router]);

  useEffect(() => {
    if (!me) return;
    void loadList();
    const t = setInterval(() => {
      void loadList();
      if (selected) void loadDetail(selected);
    }, 4000);
    return () => clearInterval(t);
  }, [me, loadList, loadDetail, selected]);

  const visible = useMemo(
    () =>
      rows.filter((r) => {
        if (filter === "mine_queue" && r.status !== "waiting_analyst") return false;
        if (filter === "agent" && r.status !== "agent") return false;
        if (filter === "mine" && !(r.status === "analyst" && r.analystId === me?.id)) return false;
        const q = query.trim().toLowerCase();
        return !q || r.employeeName.toLowerCase().includes(q) || r.lastMessage.toLowerCase().includes(q);
      }),
    [rows, filter, query, me],
  );
  const count = (f: Filter) => rows.filter((r) => (f === "mine_queue" ? r.status === "waiting_analyst" : f === "agent" ? r.status === "agent" : f === "mine" ? r.status === "analyst" && r.analystId === me?.id : true)).length;

  async function act(action: "assume" | "release" | "close" | "reply", body: object = {}) {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/console/conversations/${selected}`, { method: "POST", body: JSON.stringify({ action, ...body }) });
      if (action === "reply") setText("");
      await Promise.all([loadDetail(selected), loadList()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha na ação.");
    } finally {
      setBusy(false);
    }
  }

  const conv = detail?.conversation;
  const mine = conv?.status === "analyst" && conv.analystId === me?.id;
  const first = detail?.employee.name.split(" ")[0] ?? "";
  const related = detail?.tickets.find((t) => conv?.handoffSummary?.includes(t.id)) ?? detail?.tickets.find((t) => isOpen(t));
  const others = detail?.tickets.filter((t) => t.id !== related?.id) ?? [];
  const openCount = detail?.tickets.filter(isOpen).length ?? 0;

  return (
    <div className="flex h-screen bg-white text-slate-900">
      <nav className="flex w-14 flex-col items-center justify-between border-r border-slate-200 py-3">
        <div className="flex flex-col items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#0b5fc1] text-xs font-bold text-white">N</span>
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-[#0b5fc1]" title="Conversas">💬</span>
        </div>
        <button title="Sair" onClick={async () => { await api("/api/auth", { method: "DELETE" }); router.replace("/"); }} className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-[11px] font-semibold text-[#0b5fc1]">
          {me ? initials(me.name) : ""}
        </button>
      </nav>

      <aside className="flex w-80 flex-col border-r border-slate-200 bg-slate-50/50">
        <div className="p-4">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold">Conversas</h1>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">● Disponível</span>
          </div>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Pesquisar conversa ou chamado" className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-[#0b5fc1]" />
          <div className="mt-3 flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button key={f.value} onClick={() => setFilter(f.value)} className={`rounded-full border px-2.5 py-1 text-xs ${filter === f.value ? "border-[#0b5fc1] bg-blue-50 text-[#0b5fc1]" : "border-slate-200 bg-white text-slate-600"}`}>
                {f.label}{f.value !== "all" && <span className="ml-1 font-semibold">{count(f.value)}</span>}
              </button>
            ))}
          </div>
        </div>
        <ul className="flex-1 overflow-y-auto px-2">
          {visible.length === 0 && <li className="p-4 text-sm text-slate-500">Nenhuma conversa.</li>}
          {visible.map((r) => (
            <li key={r.id}>
              <button onClick={() => { setSelected(r.id); setDetail(null); setError(null); void loadDetail(r.id); }} className={`flex w-full gap-3 rounded-xl px-3 py-3 text-left ${selected === r.id ? "bg-blue-50" : "hover:bg-white"}`}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">{initials(r.employeeName)}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex justify-between text-sm"><b className="truncate">{r.employeeName}</b><span className="text-[11px] text-slate-400">{fmtTime(r.updatedAt)}</span></span>
                  <span className="block truncate text-xs text-slate-500">{r.lastMessage || r.title}</span>
                  <StatusLine r={r} meId={me?.id} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        {!conv || !detail ? (
          <div className="m-auto text-slate-500">{selected ? "Carregando..." : "Selecione uma conversa."}</div>
        ) : (
          <div className="flex min-h-0 flex-1">
            <div className="flex min-w-0 flex-1 flex-col bg-slate-50/60">
              <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold">{initials(detail.employee.name)}</span>
                  <div><p className="text-sm font-semibold">{detail.employee.name}</p><p className="text-xs text-slate-500">{detail.employee.department}</p></div>
                </div>
                {mine ? (
                  <div className="flex gap-2">
                    <button disabled={busy} onClick={() => act("release")} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-50">Devolver ao agent</button>
                    <button disabled={busy} onClick={() => act("close")} className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">Encerrar atendimento</button>
                  </div>
                ) : (
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs text-amber-700">{{ agent: "Com o agent", waiting_analyst: "Aguardando atendente", analyst: "Outro analista atendendo", closed: "Encerrada" }[conv.status]}</span>
                )}
              </header>

              <div className="flex-1 space-y-4 overflow-y-auto px-8 py-5">
                {conv.handoffSummary && conv.status !== "agent" && (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"><b>Resumo da transferência:</b> {conv.handoffSummary}</p>
                )}
                {detail.messages.map((m) => <ConsoleMessage key={m.id} m={m} name={detail.employee.name} />)}
                {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              </div>

              {(conv.status === "waiting_analyst" || conv.status === "agent") && (
                <div className="flex items-center justify-between border-t border-slate-200 bg-white px-6 py-3">
                  <p className="text-sm"><b>{first} {conv.status === "waiting_analyst" ? "espera um atendente" : "está com o agent"}</b><span className="block text-xs text-slate-500">{conv.status === "waiting_analyst" ? "Agent pausado" : "Assuma para pausar o agent"}</span></p>
                  <button disabled={busy} onClick={() => act("assume")} className="rounded-lg bg-[#0b5fc1] px-4 py-2 text-sm font-medium text-white hover:bg-[#094e9e] disabled:opacity-50">Assumir atendimento</button>
                </div>
              )}
              <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) void act("reply", { text }); }} className="flex items-center gap-2 border-t border-slate-200 bg-white px-6 py-3">
                <input value={text} onChange={(e) => setText(e.target.value)} disabled={!mine} maxLength={2000} placeholder={mine ? "Responder ao funcionário..." : "Assuma o atendimento para responder"} className="flex-1 rounded-lg bg-slate-100 px-3 py-2.5 text-sm outline-none disabled:text-slate-400" />
                <button disabled={!mine || busy || !text.trim()} aria-label="Enviar" className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0b5fc1] text-white disabled:opacity-40">➤</button>
              </form>
            </div>

            <aside className="hidden w-80 overflow-y-auto border-l border-slate-200 bg-white p-4 xl:block">
              <h3 className="font-semibold">Chamados de {first}</h3>
              <p className="text-xs text-slate-500">{openCount} abertos · {detail.tickets.length - openCount} encerrados</p>
              {related && (
                <>
                  <p className="mb-2 mt-5 text-xs text-slate-500">Desta conversa</p>
                  <div className="rounded-xl border border-slate-200 p-3 text-xs">
                    <p className="flex justify-between text-slate-500"><span>{related.id}</span><span className="text-amber-600">● {related.status}</span></p>
                    <p className="mt-1 text-sm font-semibold">{related.title}</p>
                    <p className="mt-1 text-slate-500">{related.category} · prioridade {related.priority.toLowerCase()} · {ago(related.updatedAt)}{related.overdue && <span className="font-medium text-red-600"> · vencido</span>}</p>
                  </div>
                </>
              )}
              {others.length > 0 && <p className="mb-1 mt-5 text-xs text-slate-500">Outros chamados</p>}
              <ul className="divide-y divide-slate-100">
                {others.map((t) => (
                  <li key={t.id} className="py-2.5 text-xs">
                    <p className="text-sm font-medium">{t.title}</p>
                    <p className="text-slate-500">{t.id} · {t.status}{t.overdue && <span className="text-red-600"> · vencido</span>}</p>
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}

function StatusLine({ r, meId }: { r: Row; meId?: string }) {
  const [label, cls] =
    r.status === "waiting_analyst" ? ["Transferida · aguardando", "text-red-600"]
    : r.status === "analyst" ? [r.analystId === meId ? "Você está atendendo" : "Outro analista atendendo", "text-[#0b5fc1]"]
    : r.status === "closed" ? ["Encerrada", "text-slate-400"]
    : ["Agent atendendo", "text-slate-500"];
  return <span className={`mt-0.5 block text-[11px] ${cls}`}>● {label}</span>;
}

function ConsoleMessage({ m, name }: { m: Message; name: string }) {
  if (m.role === "system") return <p className="text-center text-xs text-slate-500">— {m.content} · {fmtTime(m.createdAt)} —</p>;
  const right = m.role !== "user";
  const label = m.role === "assistant" ? "Nexo Assist" : m.role === "analyst" ? "Analista" : name;
  const trace = m.parts.flatMap((p) => (p.kind === "trace" ? p.steps : []));
  return (
    <div className={`flex flex-col gap-1.5 ${right ? "items-end" : "items-start"}`}>
      <p className="text-[11px] text-slate-500">
        <b>{label}</b>{m.role === "assistant" && <span className="ml-1 rounded bg-blue-100 px-1 text-[#0b5fc1]">IA</span>} · {fmtTime(m.createdAt)}
      </p>
      <div className={`max-w-[75%] whitespace-pre-wrap rounded-xl px-4 py-2.5 text-sm shadow-sm ${m.role === "user" ? "bg-white" : m.role === "analyst" ? "bg-emerald-100" : "bg-blue-50"}`}>{m.content}</div>
      {trace.length > 0 && <p className="max-w-[75%] text-[11px] text-slate-500">{trace.map((s) => `${s.ok ? "✓" : "!"} ${s.summary}`).join(" · ")}</p>}
      {m.parts.filter((p) => p.kind !== "trace" && p.kind !== "options").map((p, i) => <div key={i} className="w-full max-w-[75%]"><PartView part={p} disabled /></div>)}
    </div>
  );
}
