import { listAllConversations } from "@/lib/desk/conversations";
import { CONVERSATION_STATUSES } from "@/lib/desk/types";
import { currentEmployee, json, unauthorized } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const me = await currentEmployee();
  if (!me) return unauthorized();
  if (me.role !== "analyst") return json({ error: "Acesso restrito a analistas." }, 403);
  const s = new URL(req.url).searchParams.get("status");
  const status = CONVERSATION_STATUSES.find((x) => x === s);
  return json({ conversations: listAllConversations(status) });
}
