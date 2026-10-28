import { z } from "zod";
import { handleUserMessage } from "@/lib/desk/chat";
import { getMessages, getOwnConversation } from "@/lib/desk/conversations";
import { currentEmployee, json, unauthorized } from "@/lib/session";

export const runtime = "nodejs";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const me = await currentEmployee();
  if (!me) return unauthorized();
  const { id } = await params;
  const conversation = getOwnConversation(id, me.id);
  if (!conversation) return json({ error: "Conversa não encontrada." }, 404);
  const after = new URL(req.url).searchParams.get("after") ?? undefined;
  return json({ conversation, messages: getMessages(id, after) });
}

const Body = z.object({ text: z.string().trim().min(1).max(2000) });

export async function POST(req: Request, { params }: Ctx) {
  const me = await currentEmployee();
  if (!me) return unauthorized();
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return json({ error: "Mensagem inválida (1 a 2000 caracteres)." }, 400);
  const { id } = await params;
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const ev of handleUserMessage(me, id, body.data.text)) controller.enqueue(enc.encode(JSON.stringify(ev) + "\n"));
      } catch (e) {
        console.error(e);
        controller.enqueue(enc.encode(JSON.stringify({ type: "error", message: "Erro inesperado." }) + "\n"));
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
