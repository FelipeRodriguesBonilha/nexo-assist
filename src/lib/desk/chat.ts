import { createAgent } from "@/mastra/agent";
import { addMessage, countUserMessages, getConversation, getMessages } from "./conversations";
import type { Conversation, Employee, Message, MessagePart, TraceStep } from "./types";

export type ChatEvent =
  | { type: "user"; message: Message }
  | { type: "trace"; step: TraceStep }
  | { type: "text"; delta: string }
  | { type: "assistant"; message: Message }
  | { type: "conversation"; conversation: Conversation }
  | { type: "error"; message: string };

const MAX_USER_MESSAGES = Number(process.env.MAX_USER_MESSAGES ?? 30);
const HISTORY = 16;

const FALLBACK = "Tive um problema técnico para responder agora. Você pode tentar de novo ou pedir para falar com um analista.";

function history(conversationId: string) {
  return getMessages(conversationId)
    .filter((m) => m.role !== "system")
    .slice(-HISTORY)
    .map((m) =>
      m.role === "user"
        ? { role: "user" as const, content: m.content }
        : { role: "assistant" as const, content: m.role === "analyst" ? `[Analista humano] ${m.content}` : m.content },
    );
}

export async function* handleUserMessage(employee: Employee, conversationId: string, text: string): AsyncGenerator<ChatEvent> {
  const conv = getConversation(conversationId);
  if (!conv || conv.employeeId !== employee.id) {
    yield { type: "error", message: "Conversa não encontrada." };
    return;
  }
  if (conv.status === "closed") {
    yield { type: "error", message: "Esta conversa foi encerrada. Inicie uma nova." };
    return;
  }
  if (countUserMessages(conversationId) >= MAX_USER_MESSAGES) {
    yield { type: "error", message: `Limite de ${MAX_USER_MESSAGES} mensagens por conversa atingido. Inicie uma nova conversa.` };
    return;
  }

  yield { type: "user", message: addMessage(conversationId, "user", text) };

  // Com analista (ou aguardando um), o agent não responde.
  if (conv.status !== "agent") {
    yield { type: "conversation", conversation: getConversation(conversationId)! };
    return;
  }

  const parts: MessagePart[] = [];
  const trace: TraceStep[] = [];
  const agent = createAgent({ employee, conversationId, parts, trace });
  let answer = "";
  let seen = 0;

  try {
    const out = await agent.stream(history(conversationId), { maxSteps: 6 });
    for await (const chunk of out.fullStream) {
      if (chunk.type === "text-delta") {
        answer += chunk.payload.text;
        yield { type: "text", delta: chunk.payload.text };
      } else if (chunk.type === "tool-result" || chunk.type === "tool-error") {
        while (seen < trace.length) yield { type: "trace", step: trace[seen++]! };
      } else if (chunk.type === "error") {
        throw chunk.payload.error instanceof Error ? chunk.payload.error : new Error(String(chunk.payload.error));
      }
    }
    while (seen < trace.length) yield { type: "trace", step: trace[seen++]! };
  } catch (e) {
    console.error("[agent]", e);
    if (!answer && !parts.length) {
      yield { type: "error", message: FALLBACK };
      return;
    }
    answer ||= "Executei a ação, mas tive um problema para redigir a resposta. Confira os detalhes abaixo.";
  }

  const ordered: MessagePart[] = [...(trace.length ? [{ kind: "trace" as const, steps: trace }] : []), ...parts];
  yield { type: "assistant", message: addMessage(conversationId, "assistant", answer.trim() || "Pronto. Veja os detalhes acima.", ordered) };
  yield { type: "conversation", conversation: getConversation(conversationId)! };
}
