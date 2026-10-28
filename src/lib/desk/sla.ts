import type { Priority } from "./types";

const HOUR = 3_600_000;
const START = 8;
const END = 18;

export const SLA_LABEL: Record<Priority, string> = {
  Crítica: "1 hora",
  Alta: "4 horas úteis",
  Média: "3 dias úteis",
  Baixa: "5 dias úteis",
};

const isBusinessDay = (d: Date) => d.getDay() !== 0 && d.getDay() !== 6;

function normalize(d: Date): Date {
  const r = new Date(d);
  for (;;) {
    if (!isBusinessDay(r) || r.getHours() >= END) {
      r.setDate(r.getDate() + 1);
      r.setHours(START, 0, 0, 0);
    } else if (r.getHours() < START) {
      r.setHours(START, 0, 0, 0);
    } else return r;
  }
}

export function addBusinessHours(from: Date, hours: number): Date {
  let cur = normalize(from);
  let left = hours * HOUR;
  while (left > 0) {
    const endOfDay = new Date(cur);
    endOfDay.setHours(END, 0, 0, 0);
    const avail = endOfDay.getTime() - cur.getTime();
    if (left <= avail) return new Date(cur.getTime() + left);
    left -= avail;
    cur = normalize(endOfDay);
  }
  return cur;
}

export function addBusinessDays(from: Date, days: number): Date {
  const r = new Date(from);
  let left = days;
  while (left > 0) {
    r.setDate(r.getDate() + 1);
    if (isBusinessDay(r)) left--;
  }
  return r;
}

export function computeDueAt(priority: Priority, from: Date): Date {
  switch (priority) {
    case "Crítica":
      return new Date(from.getTime() + HOUR);
    case "Alta":
      return addBusinessHours(from, 4);
    case "Média":
      return addBusinessDays(from, 3);
    case "Baixa":
      return addBusinessDays(from, 5);
  }
}

export interface PriorityInput {
  impact: "pessoa" | "equipe" | "empresa";
  blocked: boolean;
  sameDayCommitment: boolean;
  type: "INC" | "REQ";
}

export function derivePriority({ impact, blocked, sameDayCommitment, type }: PriorityInput): Priority {
  if (blocked && impact !== "pessoa") return "Crítica";
  if (blocked || sameDayCommitment) return "Alta";
  return type === "REQ" ? "Baixa" : "Média";
}
