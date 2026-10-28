import crypto from "node:crypto";
import { getDb } from "../db";
import { callLegacy } from "./legacy";
import { computeDueAt } from "./sla";
import { isOpen } from "./tickets-shared";
import type { Category, Priority, Ticket, TicketDraft, TicketStatus, TicketType } from "./types";

interface Row {
  id: string; type: TicketType; title: string; description: string; category: Category; priority: Priority;
  status: TicketStatus; requester_id: string; created_at: string; updated_at: string; resolved_at: string | null;
}

export const REOPEN_WINDOW_MS = 7 * 24 * 3_600_000;

export function toTicket(r: Row, now = new Date()): Ticket {
  const dueAt = computeDueAt(r.priority, new Date(r.updated_at));
  const closed = r.status === "Resolvido";
  return {
    id: r.id, type: r.type, title: r.title, description: r.description, category: r.category, priority: r.priority,
    status: r.status, requesterId: r.requester_id, createdAt: r.created_at, updatedAt: r.updated_at,
    resolvedAt: r.resolved_at, dueAt: dueAt.toISOString(), overdue: !closed && now > dueAt,
  };
}

/** Leitura crua (uso interno da UI do analista). Sem filtro de dono. */
export function listTicketsOf(employeeId: string): Ticket[] {
  const rows = getDb().prepare("SELECT * FROM tickets WHERE requester_id = ? ORDER BY updated_at DESC").all(employeeId) as Row[];
  return rows.map((r) => toTicket(r));
}

export const legacyListTickets = (employeeId: string, status?: "aberto" | "resolvido") =>
  callLegacy(() => {
    const all = listTicketsOf(employeeId);
    return status === "aberto" ? all.filter(isOpen) : status === "resolvido" ? all.filter((t) => !isOpen(t)) : all;
  });

/** Privacidade: só devolve o chamado se pertencer ao solicitante. */
export const legacyGetTicket = (employeeId: string, ticketId: string) =>
  callLegacy(() => {
    const r = getDb().prepare("SELECT * FROM tickets WHERE id = ? AND requester_id = ?").get(ticketId.toUpperCase(), employeeId) as Row | undefined;
    return r ? toTicket(r) : null;
  });

const STOP = new Set(["de", "da", "do", "no", "na", "o", "a", "e", "com", "para", "meu", "minha", "um", "uma", "que", "não", "nao", "em"]);
const tokens = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w));

/** Duplicidade: chamados abertos do mesmo solicitante (ou resolvidos há <=7 dias, reabríveis) que se parecem com o texto. */
export const legacyFindSimilar = (employeeId: string, text: string, category?: Category) =>
  callLegacy(() => {
    const words = new Set(tokens(text));
    const now = Date.now();
    return listTicketsOf(employeeId)
      .map((t) => {
        const tw = tokens(`${t.title} ${t.description}`);
        const hits = tw.filter((w) => words.has(w)).length;
        const reopenable = t.status === "Resolvido" && t.resolvedAt !== null && now - new Date(t.resolvedAt).getTime() <= REOPEN_WINDOW_MS;
        const score = hits + (category && t.category === category ? 1 : 0);
        return { ticket: t, score, hits, reopenable };
      })
      .filter((m) => m.hits >= 1 && m.score >= 2 && (isOpen(m.ticket) || m.reopenable))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((m) => ({ ...m.ticket, reopenable: m.reopenable }));
  });

const nextId = (type: TicketType): string => {
  const row = getDb().prepare("SELECT id FROM tickets WHERE type = ? ORDER BY CAST(SUBSTR(id, 5) AS INTEGER) DESC LIMIT 1").get(type) as { id: string } | undefined;
  const n = row ? Number(row.id.slice(4)) + 1 : type === "INC" ? 20000 : 10000;
  return `${type}-${n}`;
};

/** Aplica o rascunho confirmado. A chave de idempotência evita criar duas vezes em caso de retry. */
export const legacyApplyDraft = (employeeId: string, draft: TicketDraft, idempotencyKey: string) =>
  callLegacy(() => {
    const db = getDb();
    const now = new Date().toISOString();
    const existing = db.prepare("SELECT * FROM tickets WHERE idempotency_key = ?").get(idempotencyKey) as Row | undefined;
    if (existing) return toTicket(existing);

    if (draft.action === "create") {
      const id = nextId(draft.type);
      db.prepare(
        "INSERT INTO tickets (id,type,title,description,category,priority,status,requester_id,created_at,updated_at,resolved_at,idempotency_key) VALUES (?,?,?,?,?,?,?,?,?,?,NULL,?)",
      ).run(id, draft.type, draft.title, draft.description, draft.category, draft.priority, "Aberto", employeeId, now, now, idempotencyKey);
      return toTicket(db.prepare("SELECT * FROM tickets WHERE id = ?").get(id) as Row);
    }

    const cur = db.prepare("SELECT * FROM tickets WHERE id = ? AND requester_id = ?").get(draft.ticketId ?? "", employeeId) as Row | undefined;
    if (!cur) throw new Error("Chamado não encontrado para este funcionário.");
    const reopen = draft.action === "reopen";
    if (reopen && (cur.status !== "Resolvido" || !cur.resolved_at || Date.now() - new Date(cur.resolved_at).getTime() > REOPEN_WINDOW_MS))
      throw new Error("Só é possível reabrir chamados resolvidos há até 7 dias.");
    const description = `${cur.description}\n\n[Atualização ${now.slice(0, 10)}] ${draft.description}`;
    db.prepare("UPDATE tickets SET description = ?, priority = ?, status = ?, resolved_at = NULL, updated_at = ?, idempotency_key = ? WHERE id = ?")
      .run(description, draft.priority, reopen ? "Aberto" : cur.status === "Aguardando analista" ? cur.status : "Em andamento", now, idempotencyKey, cur.id);
    return toTicket(db.prepare("SELECT * FROM tickets WHERE id = ?").get(cur.id) as Row);
  });

export const newId = () => crypto.randomUUID();

export { isOpen };
