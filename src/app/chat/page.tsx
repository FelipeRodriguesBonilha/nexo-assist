"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { PartView, TraceLine } from "@/components/Cards";
import { Shell } from "@/components/Shell";
import { api, fmtDate, streamChat } from "@/lib/client";
import type { Conversation, Employee, Message, TraceStep } from "@/lib/desk/types";

const MAX = 30;
const STATUS_LABEL: Record<Conversation["status"], string> = {
  agent: "Assistente online",
  waiting_analyst: "Aguardando atendente",
  analyst: "Com analista",
  closed: "Encerrada",
};

export default function ChatPage() {
  const router = useRouter();
  const [me, setMe] = useState<Employee | null>(null);
  const [list, setList] = useState<Conversation[]>([]);
  const [conv, setConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState<{ text: string; trace: TraceStep[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const refreshList = useCallback(() => api<{ conversations: Conversation[] }>("/api/conversations").then((r) => setList(r.conversations)), []);

  const open = useCallback(async (id: string) => {
    const r = await api<{ conversation: Conversation; messages: Message[] }>(`/api/conversations/${id}/messages`);
    setConv(r.conversation);
    setMessages(r.messages);
    setError(null);
  }, []);

  const create = useCallback(async () => {
    const r = await api<{ conversation: Conversation }>("/api/conversations", { method: "POST" });
    setConv(r.conversation);
    setMessages([]);
    setError(null);
    refreshList();
  }, [refreshList]);

  useEffect(() => {
    (async () => {
      const { employee } = await api<{ employee: Employee | null }>("/api/auth");
      if (!employee) return router.replace("/");
      if (employee.role === "analyst") return router.replace("/console");
      setMe(employee);
      const { conversations } = await api<{ conversations: Conversation[] }>("/api/conversations");
      setList(conversations);
      if (conversations[0]) await open(conversations[0].id);
      else await create();
    })().catch((e: Error) => setError(e.message));
  }, [router, open, create]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, live]);

  // Com analista na conversa, busca novas mensagens periodicamente.
  useEffect(() => {
    if (!conv || conv.status === "agent" || busy) return;
    const t = setInterval(() => void open(conv.id).then(refreshList).catch(() => {}), 3000);
    return () => clearInterval(t);
  }, [conv, busy, open, refreshList]);

  async function send(text: string) {
    if (!conv || !text.trim() || busy) return;
    setBusy(true);
    setError(null);
    setInput("");
    setLive({ text: "", trace: [] });
    try {
      for await (const ev of streamChat(conv.id, text.trim())) {
        if (ev.type === "user") setMessages((m) => [...m, ev.message]);
        else if (ev.type === "text") setLive((l) => l && { ...l, text: l.text + ev.delta });
        else if (ev.type === "trace") setLive((l) => l && { ...l, trace: [...l.trace, ev.step] });
        else if (ev.type === "assistant") {
          setMessages((m) => [...m, ev.message]);
          setLive(null);
        } else if (ev.type === "conversation") setConv(ev.conversation);
        else if (ev.type === "error") setError(ev.message);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao enviar a mensagem.");
    } finally {
      setLive(null);
      setBusy(false);
      refreshList();
    }
  }

  const edit = () => {
    setInput("Quero ajustar o rascunho: ");
    inputRef.current?.focus();
  };

  const used = messages.filter((m) => m.role === "user").length;
  const locked = !conv || conv.status === "closed" || used >= MAX;
  const lastId = messages[messages.length - 1]?.id;
  const online = conv?.status === "agent";

  const side = (
    <>
      <button onClick={create} disabled={busy} className="mb-2 w-full rounded-lg border border-slate-300 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-50">+ Nova conversa</button>
      <p className="mb-1 px-1 text-[11px] uppercase tracking-wide text-slate-400">Recentes</p>
      {list.map((c) => (
        <button key={c.id} onClick={() => open(c.id)} disabled={busy} className={`w-full rounded-lg px-2 py-1.5 text-left hover:bg-slate-100 ${conv?.id === c.id ? "bg-slate-100" : ""}`}>
          <p className="truncate text-xs font-medium">{c.title}</p>
          <p className="text-[11px] text-slate-400">{STATUS_LABEL[c.status]} · {fmtDate(c.updatedAt)}</p>
        </button>
      ))}
    </>
  );

  return (
    <Shell
      me={me}
      active="chat"
      title="Atendimento"
      side={side}
      right={
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${online ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
          ● {conv ? STATUS_LABEL[conv.status] : "Carregando"}
        </span>
      }
    >
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-5 px-6 py-8">
          {messages.length === 0 && !live && (
            <p className="py-16 text-center text-slate-500">Olá{me ? `, ${me.name.split(" ")[0]}` : ""}! Descreva o que está acontecendo com a sua TI.</p>
          )}
          {messages.map((m) => (
            <Bubble key={m.id} m={m} onPick={send} onEdit={edit} interactive={!busy && !locked && online && m.id === lastId} />
          ))}
          {live && (
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5"><b className="text-xs">Nexo Assist</b><TraceLine steps={live.trace} /></div>
              <div className="w-fit max-w-[85%] rounded-xl border border-slate-200 px-4 py-2.5 text-sm">
                {live.text ? <span className="whitespace-pre-wrap">{live.text}</span> : <span className="animate-pulse text-slate-400">Nexo Assist está pensando...</span>}
              </div>
            </div>
          )}
          {conv?.status === "waiting_analyst" && <Notice>Aguardando um analista assumir. O Nexo Assist não responde até lá.</Notice>}
          {conv?.status === "analyst" && <Notice>Você está conversando com um analista.</Notice>}
          {conv?.status === "closed" && <Notice>Conversa encerrada. Inicie uma nova para continuar.</Notice>}
          {used >= MAX && conv?.status !== "closed" && <Notice>Limite de {MAX} mensagens atingido. Inicie uma nova conversa.</Notice>}
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <div ref={bottom} />
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl px-6 pb-4">
        <form onSubmit={(e) => { e.preventDefault(); void send(input); }} className="flex items-center gap-2 rounded-xl border border-slate-300 py-1.5 pl-4 pr-1.5 focus-within:border-[#0b5fc1]">
          <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} disabled={locked} maxLength={2000}
            placeholder={locked ? "Conversa indisponível" : "Escreva para o Nexo..."} className="flex-1 bg-transparent text-sm outline-none" />
          <button disabled={locked || busy || !input.trim()} className="rounded-lg bg-[#0b5fc1] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#094e9e] disabled:opacity-50">↑ Enviar</button>
        </form>
        <p className="mt-1 text-right text-[11px] text-slate-400">{used}/{MAX} mensagens nesta sessão</p>
      </div>
    </Shell>
  );
}

const Notice = ({ children }: { children: React.ReactNode }) => <p className="text-center text-xs text-slate-500">{children}</p>;

function Bubble({ m, onPick, onEdit, interactive }: { m: Message; onPick: (t: string) => void; onEdit: () => void; interactive: boolean }) {
  if (m.role === "system") return <Notice>{m.content}</Notice>;
  if (m.role === "user")
    return <div className="ml-auto w-fit max-w-[75%] whitespace-pre-wrap rounded-xl bg-[#151d2e] px-4 py-2.5 text-sm text-white">{m.content}</div>;
  const trace = m.parts.flatMap((p) => (p.kind === "trace" ? p.steps : []));
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
        <b className={`text-xs ${m.role === "analyst" ? "text-emerald-700" : ""}`}>{m.role === "analyst" ? "Analista" : "Nexo Assist"}</b>
        <TraceLine steps={trace} />
      </div>
      <div className={`w-fit max-w-[85%] whitespace-pre-wrap rounded-xl border px-4 py-2.5 text-sm ${m.role === "analyst" ? "border-emerald-200 bg-emerald-50" : "border-slate-200"}`}>{m.content}</div>
      {m.parts.map((p, i) => <PartView key={i} part={p} onPick={onPick} onEdit={onEdit} disabled={!interactive} />)}
    </div>
  );
}
