"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Badge, PartView, TicketCard } from "@/components/Cards";
import { api, fmtDate, fmtTime } from "@/lib/client";
import type { Conversation, ConversationStatus, Employee, Message, Ticket } from "@/lib/desk/types";

type Row = Conversation & { employeeName: string; lastMessage: string };
interface Detail { conversation: Conversation; employee: Employee; messages: Message[]; tickets: Ticket[] }

const LABEL: Record<ConversationStatus, string> = { agent: "Com o agent", waiting_analyst: "Aguardando atendente", analyst: "Em atendimento", closed: "Encerrada" };
const STYLE: Record<ConversationStatus, string> = {
  agent: "bg-slate-100 text-slate-600",
  waiting_analyst: "bg-amber-100 text-amber-800",
  analyst: "bg-emerald-100 text-emerald-800",
  closed: "bg-slate-200 text-slate-500",
};
const FILTERS: { value: ConversationStatus | ""; label: string }[] = [
  { value: "", label: "Todas" },
  { value: "waiting_analyst", label: "Aguardando" },
  { value: "analyst", label: "Em atendimento" },
  { value: "agent", label: "Com o agent" },
  { value: "closed", label: "Encerradas" },
];

export default function ConsolePage() {
  const router = useRouter();
  const [me, setMe] = useState<Employee | null>(null);
  const [filter, setFilter] = useState<ConversationStatus | "">("");
  const [rows, setRows] = useState<Row[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadList = useCallback(
    () => api<{ conversations: Row[] }>(`/api/console/conversations${filter ? `?status=${filter}` : ""}`).then((r) => setRows(r.conversations)).catch((e: Error) => setError(e.message)),
    [filter],
  );
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

  return (
    <div className="flex h-screen">
      <aside className="flex w-80 flex-col border-r border-slate-200 bg-white">
        <div className="border-b p-4">
          <h1 className="text-lg font-bold text-indigo-700">Console do analista</h1>
          <p className="text-xs text-slate-500">{me?.name}</p>
          <div className="mt-3 flex flex-wrap gap-1">
            {FILTERS.map((f) => (
              <button key={f.value} onClick={() => setFilter(f.value)}
                className={`rounded-full px-2.5 py-1 text-xs ${filter === f.value ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <ul className="flex-1 overflow-y-auto">
          {rows.length === 0 && <li className="p-4 text-sm text-slate-500">Nenhuma conversa.</li>}
          {rows.map((r) => (
            <li key={r.id}>
              <button onClick={() => { setSelected(r.id); setDetail(null); void loadDetail(r.id); }}
                className={`w-full border-b px-4 py-3 text-left hover:bg-slate-50 ${selected === r.id ? "bg-indigo-50" : ""}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{r.employeeName}</span>
                  <Badge className={STYLE[r.status]}>{LABEL[r.status]}</Badge>
                </div>
                <p className="mt-0.5 truncate text-xs text-slate-500">{r.lastMessage || r.title}</p>
                <p className="text-[11px] text-slate-400">{fmtDate(r.updatedAt)}</p>
              </button>
            </li>
          ))}
        </ul>
        <button onClick={async () => { await api("/api/auth", { method: "DELETE" }); router.replace("/"); }} className="border-t p-3 text-left text-xs text-slate-500 underline">
          Sair
        </button>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        {!conv || !detail ? (
          <div className="m-auto text-slate-500">{selected ? "Carregando..." : "Selecione uma conversa."}</div>
        ) : (
          <>
            <header className="flex items-center justify-between border-b bg-white px-6 py-3">
              <div>
                <h2 className="font-semibold">{detail.employee.name} <span className="text-sm font-normal text-slate-500">· {detail.employee.department}</span></h2>
                <Badge className={STYLE[conv.status]}>{LABEL[conv.status]}</Badge>
              </div>
              <div className="flex gap-2">
                {(conv.status === "waiting_analyst" || conv.status === "agent") && (
                  <button disabled={busy} onClick={() => act("assume")} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">Assumir atendimento</button>
                )}
                {mine && (
                  <>
                    <button disabled={busy} onClick={() => act("release")} className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50">Devolver ao agent</button>
                    <button disabled={busy} onClick={() => act("close")} className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50">Encerrar</button>
                  </>
                )}
              </div>
            </header>

            {conv.handoffSummary && conv.status !== "agent" && (
              <div className="border-b border-amber-200 bg-amber-50 px-6 py-2 text-sm text-amber-900"><b>Resumo da transferência:</b> {conv.handoffSummary}</div>
            )}

            <div className="flex min-h-0 flex-1">
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex-1 space-y-3 overflow-y-auto px-6 py-4">
                  {detail.messages.map((m) => <ConsoleMessage key={m.id} m={m} />)}
                  {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
                </div>
                <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) void act("reply", { text }); }} className="flex gap-2 border-t bg-white p-4">
                  <input value={text} onChange={(e) => setText(e.target.value)} disabled={!mine} maxLength={2000}
                    placeholder={mine ? "Responder ao funcionário..." : "Assuma a conversa para responder"}
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 disabled:bg-slate-100" />
                  <button disabled={!mine || busy || !text.trim()} className="rounded-lg bg-indigo-600 px-5 text-sm font-medium text-white disabled:opacity-50">Enviar</button>
                </form>
              </div>
              <aside className="hidden w-80 space-y-2 overflow-y-auto border-l bg-white p-4 xl:block">
                <h3 className="text-sm font-semibold">Chamados de {detail.employee.name.split(" ")[0]}</h3>
                {detail.tickets.length === 0 && <p className="text-sm text-slate-500">Nenhum chamado.</p>}
                {detail.tickets.map((t) => <TicketCard key={t.id} ticket={t} />)}
              </aside>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function ConsoleMessage({ m }: { m: Message }) {
  if (m.role === "system") return <p className="text-center text-xs text-slate-500">{m.content}</p>;
  const mineSide = m.role === "analyst";
  return (
    <div className={`max-w-[80%] space-y-2 ${mineSide ? "ml-auto" : ""}`}>
      <p className="text-xs text-slate-500">{{ user: "Funcionário", assistant: "Nexo Assist", analyst: "Analista" }[m.role]} · {fmtTime(m.createdAt)}</p>
      {m.parts.filter((p) => p.kind === "trace").map((p, i) => <PartView key={i} part={p} />)}
      <div className={`rounded-2xl px-4 py-2 text-sm shadow-sm ${m.role === "user" ? "bg-slate-200" : mineSide ? "bg-emerald-100" : "bg-white"}`}>
        <span className="whitespace-pre-wrap">{m.content}</span>
      </div>
      {m.parts.filter((p) => p.kind !== "trace" && p.kind !== "options").map((p, i) => <PartView key={i} part={p} />)}
    </div>
  );
}
