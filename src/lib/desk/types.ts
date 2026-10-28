export const TICKET_TYPES = ["INC", "REQ"] as const;
export const CATEGORIES = ["Acesso", "Rede e VPN", "Hardware", "Software", "E-mail", "Outros"] as const;
export const PRIORITIES = ["Crítica", "Alta", "Média", "Baixa"] as const;
export const TICKET_STATUSES = ["Aberto", "Em andamento", "Aguardando analista", "Aprovado", "Resolvido"] as const;
export const CONVERSATION_STATUSES = ["agent", "waiting_analyst", "analyst", "closed"] as const;

export type TicketType = (typeof TICKET_TYPES)[number];
export type Category = (typeof CATEGORIES)[number];
export type Priority = (typeof PRIORITIES)[number];
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];

export interface Employee {
  id: string;
  email: string;
  name: string;
  role: "employee" | "analyst";
  department: string;
}

export interface Ticket {
  id: string;
  type: TicketType;
  title: string;
  description: string;
  category: Category;
  priority: Priority;
  status: TicketStatus;
  requesterId: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  dueAt: string;
  overdue: boolean;
}

export interface TicketDraft {
  action: "create" | "update" | "reopen";
  ticketId?: string;
  type: TicketType;
  title: string;
  description: string;
  category: Category;
  priority: Priority;
  impact: string;
  urgency: string;
}

export type TraceStep = { tool: string; summary: string; ok: boolean };

export type MessagePart =
  | { kind: "trace"; steps: TraceStep[] }
  | { kind: "options"; question: string; options: string[] }
  | { kind: "draft"; draftId: string; draft: TicketDraft; dueAt: string; slaLabel: string }
  | { kind: "ticket"; ticket: Ticket }
  | { kind: "tickets"; tickets: Ticket[] }
  | { kind: "handoff"; summary: string; reason: string };

export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "analyst" | "system";
  content: string;
  parts: MessagePart[];
  createdAt: string;
}

export interface Conversation {
  id: string;
  employeeId: string;
  title: string;
  status: ConversationStatus;
  analystId: string | null;
  handoffSummary: string | null;
  createdAt: string;
  updatedAt: string;
}
