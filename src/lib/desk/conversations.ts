import { getDb } from "../db";
import { newId } from "./tickets";
import type { Conversation, ConversationStatus, Message, MessagePart, TicketDraft } from "./types";

interface ConvRow {
  id: string; employee_id: string; title: string; status: ConversationStatus; analyst_id: string | null;
  handoff_summary: string | null; created_at: string; updated_at: string;
}
interface MsgRow { id: string; conversation_id: string; role: Message["role"]; content: string; parts: string; created_at: string }

const toConv = (r: ConvRow): Conversation => ({
  id: r.id, employeeId: r.employee_id, title: r.title, status: r.status, analystId: r.analyst_id,
  handoffSummary: r.handoff_summary, createdAt: r.created_at, updatedAt: r.updated_at,
});
const toMsg = (r: MsgRow): Message => ({
  id: r.id, conversationId: r.conversation_id, role: r.role, content: r.content,
  parts: JSON.parse(r.parts) as MessagePart[], createdAt: r.created_at,
});

export function createConversation(employeeId: string): Conversation {
  const id = newId();
  const now = new Date().toISOString();
  getDb().prepare("INSERT INTO conversations (id,employee_id,title,status,created_at,updated_at) VALUES (?,?,?,?,?,?)").run(id, employeeId, "Nova conversa", "agent", now, now);
  return getConversation(id)!;
}

export const getConversation = (id: string): Conversation | null => {
  const r = getDb().prepare("SELECT * FROM conversations WHERE id = ?").get(id) as ConvRow | undefined;
  return r ? toConv(r) : null;
};

/** Privacidade: conversa só é acessível ao dono. */
export const getOwnConversation = (id: string, employeeId: string): Conversation | null => {
  const c = getConversation(id);
  return c && c.employeeId === employeeId ? c : null;
};

export const listConversationsOf = (employeeId: string): Conversation[] =>
  (getDb().prepare("SELECT * FROM conversations WHERE employee_id = ? ORDER BY updated_at DESC").all(employeeId) as ConvRow[]).map(toConv);

export function listAllConversations(status?: ConversationStatus): (Conversation & { employeeName: string; lastMessage: string })[] {
  const rows = getDb()
    .prepare(
      `SELECT c.*, e.name AS employee_name,
        COALESCE((SELECT content FROM messages m WHERE m.conversation_id = c.id ORDER BY created_at DESC LIMIT 1), '') AS last_message
       FROM conversations c JOIN employees e ON e.id = c.employee_id
       ${status ? "WHERE c.status = ?" : ""} ORDER BY (c.status = 'waiting_analyst') DESC, c.updated_at DESC`,
    )
    .all(...(status ? [status] : [])) as (ConvRow & { employee_name: string; last_message: string })[];
  return rows.map((r) => ({ ...toConv(r), employeeName: r.employee_name, lastMessage: r.last_message }));
}

export function addMessage(conversationId: string, role: Message["role"], content: string, parts: MessagePart[] = []): Message {
  const db = getDb();
  const id = newId();
  const now = new Date().toISOString();
  db.prepare("INSERT INTO messages VALUES (?,?,?,?,?,?)").run(id, conversationId, role, content, JSON.stringify(parts), now);
  db.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?").run(now, conversationId);
  if (role === "user") {
    db.prepare("UPDATE conversations SET title = ? WHERE id = ? AND title = 'Nova conversa'").run(content.slice(0, 48), conversationId);
  }
  return { id, conversationId, role, content, parts, createdAt: now };
}

export const getMessages = (conversationId: string, after?: string): Message[] =>
  (getDb()
    .prepare(`SELECT * FROM messages WHERE conversation_id = ? ${after ? "AND created_at > ?" : ""} ORDER BY created_at, rowid`)
    .all(...(after ? [conversationId, after] : [conversationId])) as MsgRow[]).map(toMsg);

export const countUserMessages = (conversationId: string): number =>
  (getDb().prepare("SELECT COUNT(*) n FROM messages WHERE conversation_id = ? AND role = 'user'").get(conversationId) as { n: number }).n;

export function updateConversation(id: string, patch: { status?: ConversationStatus; analystId?: string | null; handoffSummary?: string | null }): void {
  const c = getConversation(id);
  if (!c) return;
  getDb()
    .prepare("UPDATE conversations SET status = ?, analyst_id = ?, handoff_summary = ?, updated_at = ? WHERE id = ?")
    .run(patch.status ?? c.status, patch.analystId === undefined ? c.analystId : patch.analystId, patch.handoffSummary === undefined ? c.handoffSummary : patch.handoffSummary, new Date().toISOString(), id);
}

export function setDraft(id: string, draft: TicketDraft | null): void {
  getDb().prepare("UPDATE conversations SET draft_json = ?, draft_turn = ? WHERE id = ?").run(draft ? JSON.stringify(draft) : null, draft ? countUserMessages(id) : null, id);
}

export function getDraft(id: string): { draft: TicketDraft; turn: number } | null {
  const r = getDb().prepare("SELECT draft_json, draft_turn FROM conversations WHERE id = ?").get(id) as { draft_json: string | null; draft_turn: number | null } | undefined;
  return r?.draft_json ? { draft: JSON.parse(r.draft_json) as TicketDraft, turn: r.draft_turn ?? 0 } : null;
}
