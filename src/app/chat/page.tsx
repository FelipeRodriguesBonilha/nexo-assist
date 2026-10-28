"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { PartView } from "@/components/Cards";
import { api, fmtDate, fmtTime, streamChat } from "@/lib/client";
import type { Conversation, Employee, Message, TraceStep } from "@/lib/desk/types";

const MAX = 30;
const STATUS_LABEL: Record<Conversation["status"], string> = {
  agent: "Nexo Assist",
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

  useEffect(() => bottom.current?.scrollIntoView({ behavior: "smooth" }), [messages, live]);

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

  async function logout() {
    await api("/api/auth", { method: "DELETE" });
    router.replace("/");
  }

  const used = messages.filter((m) => m.role === "user").length;
  const locked = !conv || conv.status === "closed" || used >= MAX;
  const lastIsAssistant = messages[messages.length - 1]?.id;

  return (
    <div className="flex h-screen">
      <aside className="hidden w-64 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="p-4">
          <h1 className="text-lg font-bold text-indigo-700">Nexo Assist</h1>
          <button onClick={create} disabled={busy} className="mt-3 w-full rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
            + Nova conversa
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-2">
          {list.map((c) => (
            <button key={c.id} onClick={() => open(c.id)} disabled={busy}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100 ${conv?.id === c.id ? "bg-indigo-50" : ""}`}>
              <p className="truncate font-medium">{c.title}</p>
              <p className="text-xs text-slate-500">{STATUS_LABEL[c.status]} · {fmtDate(c.updatedAt)}</p>
            </button>
          ))}
        </nav>
        <div className="border-t p-3 text-sm">
          <p className="font-medium">{me?.name}</p>
          <button onClick={logout} className="text-xs text-slate-500 underline">Sair</button>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
          <div>
            <h2 className="font-semibold">{conv?.title ?? "Carregando..."}</h2>
            {conv && <p className="text-xs text-slate-500">{STATUS_LABEL[conv.status]}</p>}
          </div>
          <span className="text-xs text-slate-500">{used}/{MAX} mensagens</span>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          {messages.length === 0 && !live && (
            <p className="mt-10 text-center text-slate-500">Olá{me ? `, ${me.name.split(" ")[0]}` : ""}! Como posso ajudar com TI hoje?</p>
          )}
          {messages.map((m) => (
            <Bubble key={m.id} m={m} onPick={send} interactive={!busy && !locked && conv?.status === "agent" && m.id === lastIsAssistant} />
          ))}
          {live && (
            <div className="max-w-[80%] space-y-2">
              {live.trace.length > 0 && <PartView part={{ kind: "trace", steps: live.trace }} />}
              <div className="rounded-2xl rounded-tl-sm bg-white px-4 py-2 text-sm shadow-sm">
                {live.text ? <span className="whitespace-pre-wrap">{live.text}</span> : <span className="animate-pulse text-slate-400">Nexo Assist está pensando...</span>}
              </div>
            </div>
          )}
          {conv?.status === "waiting_analyst" && <Notice>Aguardando um analista assumir. O Nexo Assist não responde até lá.</Notice>}
          {conv?.status === "analyst" && <Notice>Você está conversando com um analista.</Notice>}
          {conv?.status === "closed" && <Notice>Conversa encerrada. Inicie uma nova para continuar.</Notice>}
          {used >= MAX && conv?.status !== "closed" && <Notice>Limite de {MAX} mensagens atingido. Inicie uma nova conversa.</Notice>}
          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <div ref={bottom} />
        </div>

        <form onSubmit={(e) => { e.preventDefault(); void send(input); }} className="flex gap-2 border-t border-slate-200 bg-white p-4">
          <input value={input} onChange={(e) => setInput(e.target.value)} disabled={locked} maxLength={2000}
            placeholder={locked ? "Conversa indisponível" : "Descreva o que está acontecendo..."}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 disabled:bg-slate-100" />
          <button disabled={locked || busy || !input.trim()} className="rounded-lg bg-indigo-600 px-5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
            Enviar
          </button>
        </form>
      </main>
    </div>
  );
}

const Notice = ({ children }: { children: React.ReactNode }) => <p className="text-center text-xs text-slate-500">{children}</p>;

function Bubble({ m, onPick, interactive }: { m: Message; onPick: (t: string) => void; interactive: boolean }) {
  if (m.role === "system") return <Notice>{m.content}</Notice>;
  if (m.role === "user")
    return (
      <div className="ml-auto max-w-[80%] rounded-2xl rounded-tr-sm bg-indigo-600 px-4 py-2 text-sm text-white">
        <span className="whitespace-pre-wrap">{m.content}</span>
        <span className="ml-2 text-[10px] opacity-70">{fmtTime(m.createdAt)}</span>
      </div>
    );
  const trace = m.parts.filter((p) => p.kind === "trace");
  const rest = m.parts.filter((p) => p.kind !== "trace");
  return (
    <div className="max-w-[80%] space-y-2">
      {m.role === "analyst" && <p className="text-xs font-medium text-emerald-700">Analista</p>}
      {trace.map((p, i) => <PartView key={i} part={p} />)}
      <div className={`rounded-2xl rounded-tl-sm px-4 py-2 text-sm shadow-sm ${m.role === "analyst" ? "bg-emerald-50" : "bg-white"}`}>
        <span className="whitespace-pre-wrap">{m.content}</span>
      </div>
      {rest.map((p, i) => <PartView key={i} part={p} onPick={onPick} disabled={!interactive} />)}
    </div>
  );
}
