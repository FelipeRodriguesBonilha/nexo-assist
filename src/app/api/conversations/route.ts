import { createConversation, listConversationsOf } from "@/lib/desk/conversations";
import { currentEmployee, json, unauthorized } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const me = await currentEmployee();
  return me ? json({ conversations: listConversationsOf(me.id) }) : unauthorized();
}

export async function POST() {
  const me = await currentEmployee();
  return me ? json({ conversation: createConversation(me.id) }, 201) : unauthorized();
}
