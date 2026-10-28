import { z } from "zod";
import { getDb } from "@/lib/db";
import { addMessage, getConversation, getMessages, updateConversation } from "@/lib/desk/conversations";
import { listTicketsOf } from "@/lib/desk/tickets";
import { currentEmployee, json, unauthorized } from "@/lib/session";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Ctx) {
  const me = await currentEmployee();
  if (!me) return unauthorized();
  if (me.role !== "analyst") return json({ error: "Acesso restrito a analistas." }, 403);
  const { id } = await params;
  const conversation = getConversation(id);
  if (!conversation) return json({ error: "Conversa não encontrada." }, 404);
  const employee = getDb().prepare("SELECT id,email,name,role,department FROM employees WHERE id = ?").get(conversation.employeeId);
  return json({ conversation, employee, messages: getMessages(id), tickets: listTicketsOf(conversation.employeeId) });
}

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("assume") }),
  z.object({ action: z.literal("release") }),
  z.object({ action: z.literal("close") }),
  z.object({ action: z.literal("reply"), text: z.string().trim().min(1).max(2000) }),
]);

export async function POST(req: Request, { params }: Ctx) {
  const me = await currentEmployee();
  if (!me) return unauthorized();
  if (me.role !== "analyst") return json({ error: "Acesso restrito a analistas." }, 403);
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return json({ error: "Ação inválida." }, 400);
  const { id } = await params;
  const conv = getConversation(id);
  if (!conv) return json({ error: "Conversa não encontrada." }, 404);
  const a = body.data;

  if (a.action === "assume") {
    if (conv.status === "analyst" && conv.analystId !== me.id) return json({ error: "Outro analista já assumiu esta conversa." }, 409);
    if (conv.status === "closed") return json({ error: "Conversa encerrada." }, 409);
    updateConversation(id, { status: "analyst", analystId: me.id });
    addMessage(id, "system", `${me.name} assumiu o atendimento.`);
  } else if (conv.status !== "analyst" || conv.analystId !== me.id) {
    return json({ error: "Assuma a conversa antes de agir." }, 409);
  } else if (a.action === "reply") {
    addMessage(id, "analyst", a.text);
  } else if (a.action === "release") {
    updateConversation(id, { status: "agent", analystId: null, handoffSummary: null });
    addMessage(id, "system", "O atendimento voltou para o Nexo Assist.");
  } else {
    updateConversation(id, { status: "closed" });
    addMessage(id, "system", `${me.name} encerrou a conversa.`);
  }
  return json({ conversation: getConversation(id), messages: getMessages(id) });
}
