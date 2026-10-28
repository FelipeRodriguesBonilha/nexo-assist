import type { Ticket, TicketStatus } from "./types";

const OPEN: TicketStatus[] = ["Aberto", "Em andamento", "Aguardando analista", "Aprovado"];

export const isOpen = (t: Ticket) => OPEN.includes(t.status);
